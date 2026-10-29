-- Employee Management System sample database
-- Dialect: SQLite 3

PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE departments (
    department_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    location        VARCHAR(100) NOT NULL,
    budget          NUMERIC(14, 2) NOT NULL CHECK (budget >= 0)
);

CREATE TABLE employees (
    employee_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    first_name    VARCHAR(60) NOT NULL,
    last_name     VARCHAR(60) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    phone         VARCHAR(30),
    job_title     VARCHAR(100) NOT NULL,
    hire_date     DATE NOT NULL,
    salary        NUMERIC(12, 2) NOT NULL CHECK (salary >= 0),
    manager_id    INTEGER,
    CONSTRAINT fk_employees_department
        FOREIGN KEY (department_id) REFERENCES departments (department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_employees_manager
        FOREIGN KEY (manager_id) REFERENCES employees (employee_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_employee_not_own_manager
        CHECK (manager_id IS NULL OR manager_id <> employee_id)
);

CREATE TABLE projects (
    project_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name VARCHAR(150) NOT NULL UNIQUE,
    description  TEXT NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE,
    status       VARCHAR(20) NOT NULL DEFAULT 'Planned'
                 CHECK (status IN ('Planned', 'Active', 'On Hold', 'Completed')),
    budget       NUMERIC(14, 2) NOT NULL CHECK (budget >= 0),
    CONSTRAINT chk_project_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Join table: employees and projects have a many-to-many relationship.
CREATE TABLE employee_projects (
    employee_id  INTEGER NOT NULL,
    project_id   INTEGER NOT NULL,
    project_role VARCHAR(100) NOT NULL,
    assigned_on  DATE NOT NULL,
    allocation_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.00
                   CHECK (allocation_pct > 0 AND allocation_pct <= 100),
    PRIMARY KEY (employee_id, project_id),
    CONSTRAINT fk_employee_projects_employee
        FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_employee_projects_project
        FOREIGN KEY (project_id) REFERENCES projects (project_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_employees_department_id ON employees (department_id);
CREATE INDEX idx_employees_manager_id ON employees (manager_id);
CREATE INDEX idx_employee_projects_project_id ON employee_projects (project_id);
COMMIT;
