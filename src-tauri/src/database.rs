use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use std::path::PathBuf;
use dirs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subject {
    pub id: i32,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Assessment {
    pub id: i32,
    pub subject_id: i32,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: i32,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Paragraph {
    pub id: i32,
    pub assessment_id: i32,
    pub category_id: i32,
    pub name: String,
    pub content: String,
    pub image_path: Option<String>,
    pub created_at: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path()?;
        
        // Ensure the directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                    Some(format!("Failed to create directory: {}", e))
                )
            })?;
        }
        
        let conn = Connection::open(&db_path)?;
        
        // Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        let mut db = Database { conn };
        db.create_tables()?;
        db.insert_default_data()?;
        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf> {
        let app_dir = dirs::data_local_dir()
            .or_else(|| dirs::home_dir())
            .ok_or_else(|| {
                rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                    Some("Could not find suitable directory for database".to_string())
                )
            })?
            .join("feedback-management");
        
        Ok(app_dir.join("feedback.db"))
    }

    fn create_tables(&mut self) -> Result<()> {
        // Create subjects table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )",
            [],
        )?;

        // Create assessments table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create categories table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )",
            [],
        )?;

        // Create paragraphs table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS paragraphs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                image_path TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )",
            [],
        )?;

        Ok(())
    }

    fn insert_default_data(&mut self) -> Result<()> {
        // Check if categories exist
        let count: i32 = self.conn.query_row(
            "SELECT COUNT(*) FROM categories",
            [],
            |row| row.get(0),
        )?;

        if count == 0 {
            let now = Utc::now().to_rfc3339();
            
            // Insert default categories
            self.conn.execute(
                "INSERT INTO categories (name, created_at) VALUES (?1, ?2)",
                params!["General", now],
            )?;
            
            self.conn.execute(
                "INSERT INTO categories (name, created_at) VALUES (?1, ?2)",
                params!["Technical", now],
            )?;
            
            self.conn.execute(
                "INSERT INTO categories (name, created_at) VALUES (?1, ?2)",
                params!["Communication", now],
            )?;
        }

        Ok(())
    }

    // Subject operations
    pub fn get_subjects(&self) -> Result<Vec<Subject>> {
        let mut stmt = self.conn.prepare("SELECT id, name, created_at FROM subjects ORDER BY created_at DESC")?;
        let subject_iter = stmt.query_map([], |row| {
            Ok(Subject {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?;

        let mut subjects = Vec::new();
        for subject in subject_iter {
            subjects.push(subject?);
        }
        Ok(subjects)
    }

    pub fn create_subject(&mut self, name: &str) -> Result<i32> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO subjects (name, created_at) VALUES (?1, ?2)",
            params![name, now],
        )?;
        Ok(self.conn.last_insert_rowid() as i32)
    }

    pub fn update_subject(&mut self, id: i32, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE subjects SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn delete_subject(&mut self, id: i32) -> Result<()> {
        println!("Database: Executing DELETE FROM subjects WHERE id = {}", id);
        let rows_affected = self.conn.execute("DELETE FROM subjects WHERE id = ?1", params![id])?;
        println!("Database: {} rows affected by delete operation", rows_affected);
        if rows_affected == 0 {
            println!("Database: Warning - No subject found with ID {}", id);
        }
        Ok(())
    }

    // Assessment operations
    pub fn get_assessments(&self, subject_id: i32) -> Result<Vec<Assessment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, subject_id, name, created_at FROM assessments WHERE subject_id = ?1 ORDER BY created_at DESC"
        )?;
        let assessment_iter = stmt.query_map([subject_id], |row| {
            Ok(Assessment {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        let mut assessments = Vec::new();
        for assessment in assessment_iter {
            assessments.push(assessment?);
        }
        Ok(assessments)
    }

    pub fn create_assessment(&mut self, subject_id: i32, name: &str) -> Result<i32> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO assessments (subject_id, name, created_at) VALUES (?1, ?2, ?3)",
            params![subject_id, name, now],
        )?;
        Ok(self.conn.last_insert_rowid() as i32)
    }

    pub fn update_assessment(&mut self, id: i32, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE assessments SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn delete_assessment(&mut self, id: i32) -> Result<()> {
        self.conn.execute("DELETE FROM assessments WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Category operations
    pub fn get_categories(&self) -> Result<Vec<Category>> {
        let mut stmt = self.conn.prepare("SELECT id, name, created_at FROM categories ORDER BY name")?;
        let category_iter = stmt.query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?;

        let mut categories = Vec::new();
        for category in category_iter {
            categories.push(category?);
        }
        Ok(categories)
    }

    pub fn create_category(&mut self, name: &str) -> Result<i32> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO categories (name, created_at) VALUES (?1, ?2)",
            params![name, now],
        )?;
        Ok(self.conn.last_insert_rowid() as i32)
    }

    pub fn update_category(&mut self, id: i32, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE categories SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn delete_category(&mut self, id: i32) -> Result<()> {
        self.conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Paragraph operations
    pub fn get_paragraphs(&self, assessment_id: i32) -> Result<Vec<Paragraph>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, assessment_id, category_id, name, content, image_path, created_at 
             FROM paragraphs WHERE assessment_id = ?1 ORDER BY created_at DESC"
        )?;
        let paragraph_iter = stmt.query_map([assessment_id], |row| {
            Ok(Paragraph {
                id: row.get(0)?,
                assessment_id: row.get(1)?,
                category_id: row.get(2)?,
                name: row.get(3)?,
                content: row.get(4)?,
                image_path: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut paragraphs = Vec::new();
        for paragraph in paragraph_iter {
            paragraphs.push(paragraph?);
        }
        Ok(paragraphs)
    }

    pub fn get_all_paragraphs(&self) -> Result<Vec<Paragraph>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, assessment_id, category_id, name, content, image_path, created_at 
             FROM paragraphs ORDER BY category_id, created_at DESC"
        )?;
        let paragraph_iter = stmt.query_map([], |row| {
            Ok(Paragraph {
                id: row.get(0)?,
                assessment_id: row.get(1)?,
                category_id: row.get(2)?,
                name: row.get(3)?,
                content: row.get(4)?,
                image_path: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut paragraphs = Vec::new();
        for paragraph in paragraph_iter {
            paragraphs.push(paragraph?);
        }
        Ok(paragraphs)
    }

    pub fn create_paragraph(&mut self, assessment_id: i32, category_id: i32, name: &str, content: &str, image_path: Option<&str>) -> Result<i32> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO paragraphs (assessment_id, category_id, name, content, image_path, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![assessment_id, category_id, name, content, image_path, now],
        )?;
        Ok(self.conn.last_insert_rowid() as i32)
    }

    pub fn update_paragraph(&mut self, id: i32, name: &str, content: &str, category_id: i32, image_path: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE paragraphs SET name = ?1, content = ?2, category_id = ?3, image_path = ?4 WHERE id = ?5",
            params![name, content, category_id, image_path, id],
        )?;
        Ok(())
    }

    pub fn delete_paragraph(&mut self, id: i32) -> Result<()> {
        self.conn.execute("DELETE FROM paragraphs WHERE id = ?1", params![id])?;
        Ok(())
    }
}
