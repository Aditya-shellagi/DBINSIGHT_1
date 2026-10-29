-- Sample data for the Employee Management System. Run schema.sql first.
PRAGMA foreign_keys = ON;

BEGIN;

INSERT INTO departments (department_id, department_name, location, budget) VALUES
(1, 'Engineering', 'Bengaluru', 2500000.00),
(2, 'Human Resources', 'Mumbai', 750000.00),
(3, 'Finance', 'Bengaluru', 900000.00),
(4, 'Marketing', 'Delhi', 1100000.00),
(5, 'Operations', 'Hyderabad', 1300000.00);

-- Managers are inserted first; reports reference their employee IDs.
INSERT INTO employees (employee_id, department_id, first_name, last_name, email, phone, job_title, hire_date, salary, manager_id) VALUES
(1, 1, 'Aarav', 'Sharma', 'aarav.sharma@example.com', '+91-9000000001', 'Engineering Director', '2019-03-11', 1800000.00, NULL),
(2, 2, 'Meera', 'Iyer', 'meera.iyer@example.com', '+91-9000000002', 'HR Director', '2018-07-16', 1500000.00, NULL),
(3, 3, 'Rohan', 'Mehta', 'rohan.mehta@example.com', '+91-9000000003', 'Finance Director', '2017-01-09', 1600000.00, NULL),
(4, 4, 'Ananya', 'Rao', 'ananya.rao@example.com', '+91-9000000004', 'Marketing Director', '2020-05-04', 1450000.00, NULL),
(5, 5, 'Vikram', 'Nair', 'vikram.nair@example.com', '+91-9000000005', 'Operations Director', '2016-11-21', 1550000.00, NULL);

INSERT INTO employees (employee_id, department_id, first_name, last_name, email, phone, job_title, hire_date, salary, manager_id) VALUES
(6, 1, 'Ishita', 'Kapoor', 'ishita.kapoor@example.com', '+91-9000000006', 'Senior Software Engineer', '2021-02-15', 1250000.00, 1),
(7, 1, 'Kabir', 'Singh', 'kabir.singh@example.com', '+91-9000000007', 'Data Engineer', '2022-06-20', 1050000.00, 1),
(8, 1, 'Diya', 'Patel', 'diya.patel@example.com', '+91-9000000008', 'QA Engineer', '2023-01-10', 850000.00, 1),
(9, 1, 'Arjun', 'Das', 'arjun.das@example.com', '+91-9000000009', 'Cloud Engineer', '2021-09-06', 1100000.00, 1),
(10, 2, 'Sana', 'Khan', 'sana.khan@example.com', '+91-9000000010', 'Talent Acquisition Lead', '2020-08-03', 900000.00, 2),
(11, 2, 'Neel', 'Joshi', 'neel.joshi@example.com', '+91-9000000011', 'HR Specialist', '2022-04-18', 650000.00, 2),
(12, 2, 'Tara', 'Menon', 'tara.menon@example.com', '+91-9000000012', 'Learning Manager', '2021-12-01', 780000.00, 2),
(13, 3, 'Aditya', 'Verma', 'aditya.verma@example.com', '+91-9000000013', 'Financial Analyst', '2021-03-22', 920000.00, 3),
(14, 3, 'Pooja', 'Reddy', 'pooja.reddy@example.com', '+91-9000000014', 'Accountant', '2022-10-17', 700000.00, 3),
(15, 3, 'Karan', 'Bose', 'karan.bose@example.com', '+91-9000000015', 'Finance Manager', '2020-02-24', 1150000.00, 3),
(16, 4, 'Nisha', 'Gupta', 'nisha.gupta@example.com', '+91-9000000016', 'Brand Manager', '2021-07-12', 980000.00, 4),
(17, 4, 'Rahul', 'Pillai', 'rahul.pillai@example.com', '+91-9000000017', 'Content Strategist', '2023-02-06', 720000.00, 4),
(18, 5, 'Maya', 'Kulkarni', 'maya.kulkarni@example.com', '+91-9000000018', 'Operations Manager', '2020-10-05', 1050000.00, 5),
(19, 5, 'Dev', 'Chatterjee', 'dev.chatterjee@example.com', '+91-9000000019', 'Business Analyst', '2022-01-31', 820000.00, 5),
(20, 5, 'Leela', 'Fernandes', 'leela.fernandes@example.com', '+91-9000000020', 'Support Specialist', '2023-05-15', 600000.00, 5);

INSERT INTO projects (project_id, project_name, description, start_date, end_date, status, budget) VALUES
(1, 'Customer Portal', 'Build a self-service portal for customers.', '2025-01-15', '2025-10-31', 'Active', 800000.00),
(2, 'Cloud Migration', 'Move internal services to a managed cloud platform.', '2025-02-01', '2025-12-15', 'Active', 1200000.00),
(3, 'Analytics Platform', 'Create a central platform for business reporting.', '2025-03-10', NULL, 'Active', 950000.00),
(4, 'Hiring Refresh', 'Improve recruiting workflows and candidate experience.', '2025-01-20', '2025-08-30', 'Active', 250000.00),
(5, 'Finance Automation', 'Automate recurring reconciliation and reporting tasks.', '2025-04-01', '2025-11-30', 'Planned', 420000.00),
(6, 'Brand Relaunch', 'Refresh the company brand and launch updated materials.', '2025-02-10', '2025-09-30', 'Active', 500000.00),
(7, 'Service Desk Upgrade', 'Upgrade support tooling and service workflows.', '2025-05-01', '2025-12-20', 'Planned', 380000.00),
(8, 'People Learning Hub', 'Launch a learning portal for employee development.', '2025-03-01', '2025-10-15', 'Active', 300000.00),
(9, 'Data Governance', 'Establish data ownership, quality rules, and controls.', '2025-06-01', NULL, 'Planned', 600000.00),
(10, 'Process Excellence', 'Map and improve cross-functional operating processes.', '2025-01-05', '2025-07-31', 'Completed', 275000.00);

INSERT INTO employee_projects (employee_id, project_id, project_role, assigned_on, allocation_pct) VALUES
(6, 1, 'Technical Lead', '2025-01-15', 50.00),
(8, 1, 'QA Engineer', '2025-01-20', 40.00),
(7, 2, 'Data Engineer', '2025-02-01', 50.00),
(9, 2, 'Cloud Engineer', '2025-02-01', 60.00),
(7, 3, 'Data Engineer', '2025-03-10', 30.00),
(13, 3, 'Financial Analyst', '2025-03-15', 20.00),
(10, 4, 'Recruitment Lead', '2025-01-20', 50.00),
(11, 4, 'HR Specialist', '2025-01-22', 30.00),
(14, 5, 'Accountant', '2025-04-01', 50.00),
(15, 5, 'Finance Manager', '2025-04-01', 40.00),
(16, 6, 'Brand Manager', '2025-02-10', 60.00),
(17, 6, 'Content Strategist', '2025-02-10', 50.00),
(20, 7, 'Support Specialist', '2025-05-01', 60.00),
(18, 7, 'Operations Manager', '2025-05-01', 20.00),
(12, 8, 'Learning Manager', '2025-03-01', 50.00),
(11, 8, 'HR Specialist', '2025-03-01', 20.00),
(7, 9, 'Data Engineer', '2025-06-01', 30.00),
(19, 9, 'Business Analyst', '2025-06-01', 40.00),
(18, 10, 'Process Owner', '2025-01-05', 30.00),
(19, 10, 'Business Analyst', '2025-01-05', 30.00),
(6, 3, 'Application Engineer', '2025-03-18', 20.00),
(1, 2, 'Executive Sponsor', '2025-02-01', 10.00);

COMMIT;
