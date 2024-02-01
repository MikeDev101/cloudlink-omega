package data

import (
	"fmt"
	"log"

	"github.com/huandu/go-sqlbuilder"
)

func (mgr *Manager) initDB() {
	log.Print("Please wait, initializing DB...")
	mgr.createUsersTable()
	mgr.createDevelopersTable()
	mgr.createGamesTable()
	log.Print("DB Initialized!")
}

func (mgr *Manager) tableExists(tableName string) (bool, error) {
	// Build a raw SQL query to check if the table exists
	query := fmt.Sprintf("SELECT name FROM sqlite_master WHERE type='table' AND name='%s'", tableName)

	// Execute the query
	rows, err := mgr.DB.Query(query)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	// Check if the table exists based on the query result
	return rows.Next(), nil
}

func (mgr *Manager) buildTable(sb *sqlbuilder.CreateTableBuilder) {
	query, args := sb.Build()
	if _, err := mgr.DB.Query(query, args...); err != nil {
		log.Printf(`[ERROR: %s] %s`, query, err)
	} else {
		log.Printf(`[ OK ] %s`, query)
	}
}

func (mgr *Manager) createGamesTable() {
	if exists, err := mgr.tableExists("games"); err != nil {
		log.Printf("Error: %s", err)
		return
	} else if exists {
		log.Print("Games table already exists. Skipping...")
		return
	}

	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("games").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY NOT NULL`, // ULID string
		).
		Define(
			`developerid`,
			`CHAR(26) NOT NULL REFERENCES developers(id)`, // ULID string
		).
		Define(
			`name`,
			`TINYTEXT NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		).
		Define(
			`created`,
			`INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP`, // UNIX Timestamp
		)
	mgr.buildTable(sb)
}

func (mgr *Manager) createDevelopersTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("developers").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY NOT NULL`, // ULID string
		).
		Define(
			`name`,
			`TINYTEXT NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`state`,
			`SMALLINT NOT NULL DEFAULT 0`, // 2 Bytes or 16 Bits, used as a bitfield
		).
		Define(
			`created`,
			`INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP`, // UNIX Timestamp
		)
	mgr.buildTable(sb)
}

func (mgr *Manager) createUsersTable() {
	sb := sqlbuilder.NewCreateTableBuilder()
	sb.CreateTable("users").IfNotExists().
		Define(
			`id`,
			`CHAR(26) PRIMARY KEY NOT NULL`, // ULID string
		).
		Define(
			`username`,
			`TINYTEXT NOT NULL DEFAULT ''`, // 255 maximum length
		).
		Define(
			`password`,
			`TINYTEXT NOT NULL DEFAULT ''`, // Scrypt hash
		).
		Define(
			`email`,
			`VARCHAR(320) NOT NULL DEFAULT ''`, // Longest (insane) email address is 320 characters long. But why would you do that to yourself?
		).
		Define(
			`created`,
			`INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP`, // UNIX Timestamp
		)
	mgr.buildTable(sb)
}
