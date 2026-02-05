package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token has expired")
)

// Claims for access tokens
type Claims struct {
	UserID   uuid.UUID       `json:"uid"`
	Username string          `json:"sub"`
	Role     entity.UserRole `json:"role"`
	jwt.RegisteredClaims
}

// MFASetupClaims for MFA setup tokens (limited scope)
type MFASetupClaims struct {
	UserID   uuid.UUID `json:"uid"`
	Username string    `json:"sub"`
	Purpose  string    `json:"purpose"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secretKey       []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
	mfaSetupTTL     time.Duration
	issuer          string
}

func NewJWTManager(secretKey string, accessTTL, refreshTTL time.Duration, issuer string) *JWTManager {
	return &JWTManager{
		secretKey:       []byte(secretKey),
		accessTokenTTL:  accessTTL,
		refreshTokenTTL: refreshTTL,
		mfaSetupTTL:     10 * time.Minute, // MFA setup token valid for 10 minutes
		issuer:          issuer,
	}
}

// GenerateAccessToken creates a new JWT access token
func (m *JWTManager) GenerateAccessToken(user *entity.User) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    m.issuer,
			Subject:   user.Username,
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secretKey)
}

// ValidateAccessToken validates and parses a JWT token
func (m *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GenerateMFASetupToken creates a limited-scope token for MFA setup
func (m *JWTManager) GenerateMFASetupToken(user *entity.User) (string, error) {
	now := time.Now()
	claims := MFASetupClaims{
		UserID:   user.ID,
		Username: user.Username,
		Purpose:  "mfa_setup",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.mfaSetupTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    m.issuer,
			Subject:   user.Username,
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secretKey)
}

// ValidateMFASetupToken validates and parses an MFA setup token
func (m *JWTManager) ValidateMFASetupToken(tokenString string) (*MFASetupClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &MFASetupClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*MFASetupClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	// Verify the purpose
	if claims.Purpose != "mfa_setup" {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GenerateRefreshToken creates a random refresh token
func (m *JWTManager) GenerateRefreshToken() (token string, hash string, expiresAt time.Time, err error) {
	bytes := make([]byte, 32)
	if _, err = rand.Read(bytes); err != nil {
		return "", "", time.Time{}, err
	}

	token = hex.EncodeToString(bytes)
	hash = HashToken(token)
	expiresAt = time.Now().Add(m.refreshTokenTTL)

	return token, hash, expiresAt, nil
}

// HashToken creates a SHA256 hash of a token
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
