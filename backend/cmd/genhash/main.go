package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	password := "admin123"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Password: %s\n", password)
	fmt.Printf("Hash: %s\n", string(hash))

	// Verify
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	if err != nil {
		fmt.Println("Verification FAILED!")
	} else {
		fmt.Println("Verification OK!")
	}

	// Test old hash
	oldHash := "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G6h.2tQxJGC0Iy"
	err = bcrypt.CompareHashAndPassword([]byte(oldHash), []byte(password))
	if err != nil {
		fmt.Printf("Old hash does NOT match '%s': %v\n", password, err)
	} else {
		fmt.Println("Old hash matches!")
	}
}
