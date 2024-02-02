package data

import (
	"database/sql"
	"log"
	"strings"

	"github.com/huandu/go-sqlbuilder"
	errors "github.com/mikedev101/cloudlink-omega/backend/pkg/errors"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
	"github.com/oklog/ulid/v2"
)

func (mgr *Manager) RunSelectQuery(sb *sqlbuilder.SelectBuilder) (*sql.Rows, error) {
	query, args := sb.Build()
	if res, err := mgr.DB.Query(query, args...); err != nil {
		log.Printf("ERROR: Failed to execute select request:\n\tquery: %s\n\targs: %v\n\tmessage: %s", query, args, err)
		return nil, err
	} else {
		log.Printf("SUCCESS: Executed select request:\n\tquery: %s\n\targs: %v", query, args) // DEBUGGING ONLY
		return res, nil
	}
}

func (mgr *Manager) RunInsertQuery(sb *sqlbuilder.InsertBuilder) (sql.Result, error) {
	query, args := sb.Build()
	if res, err := mgr.DB.Exec(query, args...); err != nil {
		log.Printf("ERROR: Failed to execute insert request:\n\tquery: %s\n\targs: %v\n\tmessage: %s", query, args, err)
		return nil, err
	} else {
		log.Printf("SUCCESS: Executed insert request:\n\tquery: %s\n\targs: %v", query, args) // DEBUGGING ONLY
		return res, nil
	}
}

func (mgr *Manager) FindAllUsers() map[string]*structs.UserQuery {
	qy := sqlbuilder.NewSelectBuilder().
		Select("id", "username", "email", "created").
		From("users")
	if res, err := mgr.RunSelectQuery(qy); err != nil {
		return nil
	} else {
		// Scan all rows, using ID as the key and User as the value
		rows := make(map[string]*structs.UserQuery)
		for res.Next() {
			var u structs.UserQuery
			err := res.Scan(&u.ID, &u.Username, &u.Email, &u.Created)
			if err != nil {
				log.Printf(`[ERROR] Failed to find all users: %s`, err)
				return nil
			}
			rows[u.ID] = &u
		}
		return rows
	}
}

// RegisterUser registers a user in the Manager.
//
// u *structs.User - the user to be registered
// (sql.Result, error) - the result of the registration and any error encountered
func (mgr *Manager) RegisterUser(u *structs.Register) (bool, error) {
	qy := sqlbuilder.NewInsertBuilder().
		InsertInto("users").
		Cols("id", "username", "password", "gamertag", "email").
		Values(ulid.Make().String(), u.Username, u.Password, u.Gamertag, u.Email)

	res, err := mgr.RunInsertQuery(qy)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			if strings.Contains(err.Error(), "username") {
				return false, errors.ErrUsernameInUse
			} else if strings.Contains(err.Error(), "email") {
				return false, errors.ErrEmailInUse
			} else if strings.Contains(err.Error(), "gamertag") {
				return false, errors.ErrGamertagInUse
			}
		}
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows == 1, nil
}

// GetUserPasswordHash retrieves the password hash for the given email.
//
// email string
// string, error
func (mgr *Manager) GetUserPasswordHash(email string) (string, error) {
	qy := sqlbuilder.NewSelectBuilder()
	qy.Distinct().Select("password")
	qy.From("users")
	qy.Where(
		qy.E("email", email),
	)
	var hash string
	res, err := mgr.RunSelectQuery(qy)
	if err != nil {
		return "", err
	}
	if res.Next() {
		if err := res.Scan(&hash); err != nil {
			return "", err
		}
	} else {
		return "", errors.ErrUserNotFound
	}
	return hash, nil
}

// GetUserID retrieves the user ID for the given email.
//
// email string - the email of the user
// string, error - the user ID and any error encountered
func (mgr *Manager) GetUserID(email string) (string, error) {
	qy := sqlbuilder.NewSelectBuilder()
	qy.Distinct().Select("id")
	qy.From("users")
	qy.Where(
		qy.E("email", email),
	)
	var userid string
	res, err := mgr.RunSelectQuery(qy)
	if err != nil {
		return "", err
	}
	if res.Next() {
		if err := res.Scan(&userid); err != nil {
			return "", err
		}
	} else {
		return "", errors.ErrUserNotFound
	}
	return userid, nil
}

// GenerateSessionToken generates a session token for the given user ID and origin.
//
// userid: string representing the user ID
// origin: string representing the origin of the session
// string: the generated session token
// error: an error, if any
func (mgr *Manager) GenerateSessionToken(userid string, origin string) (string, error) {
	usertoken := ulid.Make().String()
	qy := sqlbuilder.NewInsertBuilder().
		InsertInto("sessions").
		Cols("id", "userid", "origin").
		Values(usertoken, userid, origin)
	res, err := mgr.RunInsertQuery(qy)
	if err != nil {
		return "", err
	}
	rows, _ := res.RowsAffected()
	if rows != 1 {
		return "", errors.ErrDatabaseError
	}
	return usertoken, nil
}

// VerifyUGI is a function that verifies the given UGI (Unique Game Identifier).
//
// It takes a parameter ugi string and returns an error.
func (mgr *Manager) VerifyUGI(ugi string) (string, string, error) {
	qy := sqlbuilder.NewSelectBuilder()
	qy.Select(
		qy.As("g.name", "gameName"),
		qy.As("d.name", "developerName"),
	).
		From("games g", "developers d").
		Where(
			qy.E("g.id", ugi),
			qy.And("g.developerid = d.id"),
		)

	if res, err := mgr.RunSelectQuery(qy); err != nil {
		return "", "", err
	} else {
		var gameName string
		var developerName string

		// Check if there's any output from the query (there should be 1 row if the game exists)
		if !res.Next() {
			return "", "", errors.ErrGameNotFound
		}
		// Scan the output into the variables
		if err := res.Scan(&gameName, &developerName); err != nil {
			return "", "", err
		}
		return gameName, developerName, nil
	}
}
