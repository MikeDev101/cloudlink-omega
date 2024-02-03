package structs

// JSON structure for user creation.
type Register struct {
	Username string `json:"username" validate:"required,min=3,max=20" label:"username"`
	Password string `json:"password" validate:"required,min=8,max=128" label:"password"`
	Email    string `json:"email" validate:"required,email,max=320" label:"email"`
}

// JSON structure for logging in.
type Login struct {
	Email    string `json:"email" validate:"required,email,max=320" label:"email"`
	Password string `json:"password" validate:"required,min=8,max=128" label:"password"`
}
