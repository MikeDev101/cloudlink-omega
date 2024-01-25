package clomega

import (
	"database/sql"

	scrypt "github.com/elithrar/simple-scrypt"
)

// JSON structure for user creation.
type User struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Gamertag string `json:"gamertag"`
	Email    string `json:"email"`
}

// JSON structure for logging in.
type Login struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Create a config structure for the server, providing public variable configurations for the params and the database.
type Config struct {
	ScryptParams scrypt.Params
	Database     *sql.DB
}

// Declare the packet format for signaling.
type SignalPacket struct {
	Opcode    string `json:"opcode"`
	Payload   any    `json:"payload"`
	Origin    string `json:"origin,omitempty"`
	Recipient string `json:"recipient,omitempty"`
}
