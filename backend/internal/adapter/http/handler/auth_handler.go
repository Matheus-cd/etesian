package handler

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
	"github.com/etesian/backend/internal/infrastructure/crypto"
)

type AuthHandler struct {
	userRepo     repository.UserRepository
	tokenRepo    repository.RefreshTokenRepository
	jwtManager   *crypto.JWTManager
	maxAttempts  int
	lockDuration time.Duration
}

func NewAuthHandler(
	userRepo repository.UserRepository,
	tokenRepo repository.RefreshTokenRepository,
	jwtManager *crypto.JWTManager,
) *AuthHandler {
	return &AuthHandler{
		userRepo:     userRepo,
		tokenRepo:    tokenRepo,
		jwtManager:   jwtManager,
		maxAttempts:  3,
		lockDuration: 15 * time.Minute,
	}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	MFACode  string `json:"mfa_code,omitempty"`
}

type LoginResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresIn    int          `json:"expires_in"`
	User         UserResponse `json:"user"`
}

type MFARequiredResponse struct {
	MFARequired bool   `json:"mfa_required"`
	MFASetup    bool   `json:"mfa_setup"`
	SetupToken  string `json:"setup_token,omitempty"`
	Message     string `json:"message"`
}

type UserResponse struct {
	ID         string          `json:"id"`
	Username   string          `json:"username"`
	Email      string          `json:"email"`
	FullName   string          `json:"full_name"`
	Role       entity.UserRole `json:"role"`
	MFAEnabled bool            `json:"mfa_enabled"`
}

// Login handles user authentication
// Flow:
// 1. If MFA not enabled -> return setup_token for MFA setup
// 2. If MFA enabled but no code provided -> return mfa_required: true
// 3. If MFA enabled and code provided -> validate and return tokens
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		response.BadRequest(w, "Username and password required")
		return
	}

	user, err := h.userRepo.GetByUsername(r.Context(), req.Username)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if user == nil {
		response.Unauthorized(w, "Invalid credentials")
		return
	}

	// Check if locked
	if user.IsLocked() {
		response.Unauthorized(w, "Account is locked. Try again later")
		return
	}

	// Check if inactive
	if user.Status != entity.StatusActive {
		response.Unauthorized(w, "Account is not active")
		return
	}

	// Verify password
	if !crypto.CheckPassword(req.Password, user.PasswordHash) {
		h.userRepo.IncrementFailedAttempts(r.Context(), user.ID)

		// Lock if max attempts reached
		if user.FailedLoginAttempts+1 >= h.maxAttempts {
			lockUntil := time.Now().Add(h.lockDuration)
			user.LockedUntil = &lockUntil
			h.userRepo.LockUser(r.Context(), user.ID, user)
		}

		response.Unauthorized(w, "Invalid credentials")
		return
	}

	// Reset failed attempts after successful password verification
	h.userRepo.ResetFailedAttempts(r.Context(), user.ID)

	// Check if MFA is enabled
	if !user.MFAEnabled {
		// User needs to setup MFA - generate a temporary setup token
		setupToken, err := h.jwtManager.GenerateMFASetupToken(user)
		if err != nil {
			response.InternalError(w, "Failed to generate setup token")
			return
		}

		response.JSON(w, http.StatusAccepted, MFARequiredResponse{
			MFARequired: true,
			MFASetup:    true,
			SetupToken:  setupToken,
			Message:     "MFA setup required. Use the setup token to configure MFA.",
		})
		return
	}

	// MFA is enabled - check if code was provided
	if req.MFACode == "" {
		response.JSON(w, http.StatusAccepted, MFARequiredResponse{
			MFARequired: true,
			MFASetup:    false,
			Message:     "MFA code required",
		})
		return
	}

	// Validate MFA code
	if user.MFASecret == nil || !crypto.ValidateMFACode(req.MFACode, *user.MFASecret) {
		response.Unauthorized(w, "Invalid MFA code")
		return
	}

	// All verified - generate full access tokens
	h.issueTokens(w, r, user)
}

// MFASetup initiates MFA setup for a user
// Requires: setup_token from login response
type MFASetupRequest struct {
	SetupToken string `json:"setup_token"`
}

type MFASetupResponse struct {
	Secret     string `json:"secret"`
	QRCode     string `json:"qr_code"`
	Issuer     string `json:"issuer"`
	AccountName string `json:"account_name"`
}

func (h *AuthHandler) MFASetup(w http.ResponseWriter, r *http.Request) {
	var req MFASetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.SetupToken == "" {
		response.BadRequest(w, "Setup token required")
		return
	}

	// Validate setup token
	claims, err := h.jwtManager.ValidateMFASetupToken(req.SetupToken)
	if err != nil {
		response.Unauthorized(w, "Invalid or expired setup token")
		return
	}

	// Get user
	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil || user == nil {
		response.NotFound(w, "User not found")
		return
	}

	// Check if MFA is already enabled
	if user.MFAEnabled {
		response.BadRequest(w, "MFA is already enabled")
		return
	}

	var secret string

	// If user already has a pending MFA secret (setup started but not verified), reuse it
	// This prevents generating a new secret every time the setup page is loaded
	if user.MFASecret != nil && *user.MFASecret != "" {
		secret = *user.MFASecret
	} else {
		// Generate new MFA secret
		key, err := crypto.GenerateMFASecret(user.Username)
		if err != nil {
			response.InternalError(w, "Failed to generate MFA secret")
			return
		}

		secret = key.Secret()

		// Store the secret temporarily (not enabled yet)
		if err := h.userRepo.UpdateMFASecret(r.Context(), user.ID, &secret, false); err != nil {
			response.InternalError(w, "Failed to store MFA secret")
			return
		}
	}

	// Generate QR code from the secret
	qrCode, err := crypto.GenerateMFAQRCodeFromSecret(secret, user.Username)
	if err != nil {
		response.InternalError(w, "Failed to generate QR code")
		return
	}

	response.Success(w, MFASetupResponse{
		Secret:      secret,
		QRCode:      "data:image/png;base64," + base64.StdEncoding.EncodeToString(qrCode),
		Issuer:      "Etesian",
		AccountName: user.Username,
	})
}

// MFAVerify completes MFA setup by verifying the first code
type MFAVerifyRequest struct {
	SetupToken string `json:"setup_token"`
	Code       string `json:"code"`
}

func (h *AuthHandler) MFAVerify(w http.ResponseWriter, r *http.Request) {
	var req MFAVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.SetupToken == "" || req.Code == "" {
		response.BadRequest(w, "Setup token and code required")
		return
	}

	// Validate setup token
	claims, err := h.jwtManager.ValidateMFASetupToken(req.SetupToken)
	if err != nil {
		response.Unauthorized(w, "Invalid or expired setup token")
		return
	}

	// Get user
	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil || user == nil {
		response.NotFound(w, "User not found")
		return
	}

	// Check if user has a pending MFA secret
	if user.MFASecret == nil {
		response.BadRequest(w, "MFA setup not initiated")
		return
	}

	// Validate the code
	if !crypto.ValidateMFACode(req.Code, *user.MFASecret) {
		response.Unauthorized(w, "Invalid MFA code")
		return
	}

	// Enable MFA
	if err := h.userRepo.UpdateMFASecret(r.Context(), user.ID, user.MFASecret, true); err != nil {
		response.InternalError(w, "Failed to enable MFA")
		return
	}

	// MFA is now enabled - issue full tokens
	user.MFAEnabled = true
	h.issueTokens(w, r, user)
}

// issueTokens generates and returns access and refresh tokens
func (h *AuthHandler) issueTokens(w http.ResponseWriter, r *http.Request, user *entity.User) {
	accessToken, err := h.jwtManager.GenerateAccessToken(user)
	if err != nil {
		response.InternalError(w, "Failed to generate token")
		return
	}

	refreshToken, tokenHash, expiresAt, err := h.jwtManager.GenerateRefreshToken()
	if err != nil {
		response.InternalError(w, "Failed to generate refresh token")
		return
	}

	if err := h.tokenRepo.Create(r.Context(), user.ID, tokenHash, expiresAt); err != nil {
		response.InternalError(w, "Failed to store refresh token")
		return
	}

	response.Success(w, LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900, // 15 minutes
		User: UserResponse{
			ID:         user.ID.String(),
			Username:   user.Username,
			Email:      user.Email,
			FullName:   user.FullName,
			Role:       user.Role,
			MFAEnabled: user.MFAEnabled,
		},
	})
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.RefreshToken == "" {
		response.BadRequest(w, "Refresh token required")
		return
	}

	tokenHash := crypto.HashToken(req.RefreshToken)
	storedToken, err := h.tokenRepo.GetByHash(r.Context(), tokenHash)
	if err != nil {
		log.Printf("[RefreshToken] Database error: %v", err)
		response.InternalError(w, "Database error")
		return
	}

	if storedToken == nil {
		response.Unauthorized(w, "Invalid refresh token")
		return
	}

	// Get user
	user, err := h.userRepo.GetByID(r.Context(), storedToken.UserID)
	if err != nil || user == nil {
		response.Unauthorized(w, "User not found")
		return
	}

	// Revoke old token
	h.tokenRepo.Revoke(r.Context(), tokenHash)

	// Generate new tokens
	accessToken, err := h.jwtManager.GenerateAccessToken(user)
	if err != nil {
		response.InternalError(w, "Failed to generate token")
		return
	}

	newRefreshToken, newTokenHash, expiresAt, err := h.jwtManager.GenerateRefreshToken()
	if err != nil {
		response.InternalError(w, "Failed to generate refresh token")
		return
	}

	if err := h.tokenRepo.Create(r.Context(), user.ID, newTokenHash, expiresAt); err != nil {
		response.InternalError(w, "Failed to store refresh token")
		return
	}

	response.Success(w, map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": newRefreshToken,
		"expires_in":    900,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		response.Unauthorized(w, "Not authenticated")
		return
	}

	// Revoke all refresh tokens for user
	h.tokenRepo.RevokeAllForUser(r.Context(), claims.UserID)

	response.Success(w, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		response.Unauthorized(w, "Not authenticated")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil || user == nil {
		response.NotFound(w, "User not found")
		return
	}

	response.Success(w, UserResponse{
		ID:         user.ID.String(),
		Username:   user.Username,
		Email:      user.Email,
		FullName:   user.FullName,
		Role:       user.Role,
		MFAEnabled: user.MFAEnabled,
	})
}
