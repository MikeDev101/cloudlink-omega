package data

import (
	"database/sql"
	"log"

	"github.com/huandu/go-sqlbuilder"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
	"github.com/oklog/ulid/v2"
)

func (mgr *Manager) RunSelectQuery(sb *sqlbuilder.SelectBuilder) *sql.Rows {
	query, args := sb.Build()
	if res, err := mgr.DB.Query(query, args...); err != nil {
		log.Printf("ERROR: Failed to execute select request:\n\tquery: %s\n\targs: %v\n\tmessage: %s", query, args, err)
		return nil
	} else {
		log.Printf("SUCCESS: Executed select request:\n\tquery: %s\n\targs: %v", query, args) // DEBUGGING ONLY
		return res
	}
}

func (mgr *Manager) RunInsertQuery(sb *sqlbuilder.InsertBuilder) sql.Result {
	query, args := sb.Build()
	if res, err := mgr.DB.Exec(query, args...); err != nil {
		log.Printf("ERROR: Failed to execute insert request:\n\tquery: %s\n\targs: %v\n\tmessage: %s", query, args, err)
		return nil
	} else {
		log.Printf("SUCCESS: Executed insert request:\n\tquery: %s\n\targs: %v", query, args) // DEBUGGING ONLY
		return res
	}
}

func (mgr *Manager) FindAllUsers() map[string]*structs.UserQuery {
	qy := sqlbuilder.NewSelectBuilder().
		Select("id", "username", "email", "created").
		From("users")
	if res := mgr.RunSelectQuery(qy); res == nil {
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

func (mgr *Manager) RegisterUser(u *structs.User) sql.Result {
	qy := sqlbuilder.NewInsertBuilder().
		InsertInto("users").
		Cols("id", "username", "password", "gamertag", "email").
		Values(ulid.Make().String(), u.Username, u.Password, u.Gamertag, u.Email)
	return mgr.RunInsertQuery(qy)
}
