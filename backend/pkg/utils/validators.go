package utils

import (
	validator "github.com/go-playground/validator/v10"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
)

func VariableContainsValidationError(varname string, err error) *structs.RootError {
	if err != nil && len(err.(validator.ValidationErrors)) > 0 {

		// Create error message
		msg := &structs.RootError{}

		// Unwrap single error
		err := err.(validator.ValidationErrors)[0]

		// Create error message
		entry := map[string]string{}
		entry[varname] = err.Tag()
		msg.Errors = append(msg.Errors, entry)

		return msg
	}
	return nil
}

func StructContainsValidationError(err error) *structs.RootError {
	if err != nil && len(err.(validator.ValidationErrors)) > 0 {

		// Create error messages
		msg := &structs.RootError{}
		// Unwrap all errors
		for _, err := range err.(validator.ValidationErrors) {
			// Create all error messages
			entry := map[string]string{}
			entry[err.Field()] = err.Tag()
			msg.Errors = append(msg.Errors, entry)
		}
		return msg
	}

	return nil
}
