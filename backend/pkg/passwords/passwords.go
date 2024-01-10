package passwords

import (
	"log"

	scrypt "github.com/elithrar/simple-scrypt"
)

// HashPassword generates a hashed password using the scrypt algorithm.
//
// It takes a string parameter `password` which is the password to be hashed.
// Returns a string which is the hashed password.
func HashPassword(password string, params scrypt.Params) string {
	hash, err := scrypt.GenerateFromPassword([]byte(password), params)
	if err != nil {
		log.Fatal(err)
	}
	return string(hash)
}

// verifyPassword verifies the given password against the provided hash.
//
// password - The password to be verified.
// hash - The hash to compare the password against.
// error - An error if the verification fails.
func VerifyPassword(password string, hash string) error {
	err := scrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err
}
