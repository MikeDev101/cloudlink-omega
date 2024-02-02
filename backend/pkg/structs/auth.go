package structs

// JSON structure for user creation.
type Register struct {
	Username string `json:"username" validate:"required,max=20"`
	Password string `json:"password" validate:"required,min=8,max=128"`
	Gamertag string `json:"gamertag" validate:"required,max=20"`
	Email    string `json:"email" validate:"required,email,max=320"`
}

// JSON structure for logging in.
type Login struct {
	Email    string `json:"email" validate:"required,email,max=320"`
	Password string `json:"password" validate:"required,min=8,max=128"`
}
