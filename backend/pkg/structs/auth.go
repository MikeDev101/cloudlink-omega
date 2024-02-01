package structs

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
