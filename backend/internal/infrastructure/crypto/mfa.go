package crypto

import (
	"bytes"
	"image/png"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const (
	mfaIssuer = "Etesian"
	mfaDigits = 6
	mfaPeriod = 30
)

// GenerateMFASecret creates a new TOTP secret for a user
func GenerateMFASecret(username string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      mfaIssuer,
		AccountName: username,
		Digits:      otp.DigitsSix,
		Period:      mfaPeriod,
		Algorithm:   otp.AlgorithmSHA1,
	})
}

// ValidateMFACode validates a TOTP code against a secret
func ValidateMFACode(code, secret string) bool {
	return totp.Validate(code, secret)
}

// GetMFAProvisioningURI returns the URI for QR code generation
func GetMFAProvisioningURI(key *otp.Key) string {
	return key.URL()
}

// GenerateMFAQRCode generates a PNG QR code for the TOTP key
func GenerateMFAQRCode(key *otp.Key) ([]byte, error) {
	img, err := key.Image(200, 200)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// GenerateMFAQRCodeFromSecret generates a PNG QR code from an existing secret
func GenerateMFAQRCodeFromSecret(secret, username string) ([]byte, error) {
	// Reconstruct the key from the secret using the otpauth URL format
	url := "otpauth://totp/" + mfaIssuer + ":" + username + "?secret=" + secret + "&issuer=" + mfaIssuer + "&algorithm=SHA1&digits=6&period=30"
	key, err := otp.NewKeyFromURL(url)
	if err != nil {
		return nil, err
	}

	return GenerateMFAQRCode(key)
}
