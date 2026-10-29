'use strict';

const MAX_ROWS = 100;
const QUERY_ROW_LIMIT = MAX_ROWS + 1;

const templates = Object.freeze({
  departments: `SELECT department_id, department_name, location, budget
FROM departments
ORDER BY department_name
LIMIT ?`,
  employees: `SELECT employee_id, first_name, last_name, email, job_title, salary, hire_date
FROM employees
ORDER BY last_name, first_name
LIMIT ?`,
  employeesByDepartment: `SELECT e.employee_id, e.first_name, e.last_name, e.job_title, e.salary, d.department_name
FROM employees AS e
JOIN departments AS d ON d.department_id = e.department_id
WHERE lower(d.department_name) = lower(?)
ORDER BY e.last_name, e.first_name
LIMIT ?`,
  employeesBySalary: `SELECT employee_id, first_name, last_name, job_title, salary
FROM employees
WHERE salary {operator} ?
ORDER BY salary DESC, last_name, first_name
LIMIT ?`,
  highestPaid: `SELECT employee_id, first_name, last_name, job_title, salary
FROM employees
ORDER BY salary DESC, last_name, first_name
LIMIT ?`,
  employeeCounts: `SELECT d.department_name, COUNT(e.employee_id) AS employee_count
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.department_id
GROUP BY d.department_id, d.department_name
ORDER BY d.department_name
LIMIT ?`,
  employeeCountByDepartment: `SELECT d.department_name, COUNT(e.employee_id) AS employee_count
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.department_id
WHERE lower(d.department_name) = lower(?)
GROUP BY d.department_id, d.department_name
LIMIT ?`,
  averageSalary: `SELECT d.department_name, ROUND(AVG(e.salary), 2) AS average_salary
FROM departments AS d
JOIN employees AS e ON e.department_id = d.department_id
GROUP BY d.department_id, d.department_name
ORDER BY average_salary DESC
LIMIT ?`,
  projects: `SELECT project_id, project_name, description, start_date, end_date, status, budget
FROM projects
ORDER BY start_date DESC, project_name
LIMIT ?`,
  projectsByStatus: `SELECT project_id, project_name, description, start_date, end_date, status, budget
FROM projects
WHERE lower(status) = lower(?)
ORDER BY start_date DESC, project_name
LIMIT ?`,
  assignments: `SELECT e.first_name, e.last_name, p.project_name, ep.project_role, ep.allocation_pct, ep.assigned_on
FROM employee_projects AS ep
JOIN employees AS e ON e.employee_id = ep.employee_id
JOIN projects AS p ON p.project_id = ep.project_id
ORDER BY p.project_name, e.last_name, e.first_name
LIMIT ?`,
  summary: `SELECT
  (SELECT COUNT(*) FROM departments) AS department_count,
  (SELECT COUNT(*) FROM employees) AS employee_count,
  (SELECT COUNT(*) FROM projects) AS project_count,
  (SELECT COUNT(*) FROM employee_projects) AS assignment_count`
});

const approvedSql = new Set(Object.values(templates).filter((sql) => !sql.includes('{operator}')));
for (const operator of ['>', '>=', '<', '<=']) {
  approvedSql.add(templates.employeesBySalary.replace('{operator}', operator));
}

const forbidden = /\b(?:DROP|DELETE|UPDATE|INSERT|INSETRT|ALTER|TRUNCATE|REPLACE|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i;
const departments = [
  { aliases: ['human resources', 'hr', 'people'], name: 'Human Resources' },
  { aliases: ['engineering', 'engineers'], name: 'Engineering' },
  { aliases: ['finance', 'financial'], name: 'Finance' },
  { aliases: ['marketing'], name: 'Marketing' },
  { aliases: ['operations', 'ops'], name: 'Operations' }
];
const projectStatuses = ['active', 'planned', 'on hold', 'completed'];

function cleanQuestion(value) {
  if (typeof value !== 'string') {
    throw new QueryError('Please enter a question in plain language.', 'QUESTION_REQUIRED');
  }
  const question = value.trim().replace(/\s+/g, ' ');
  if (!question) throw new QueryError('Type a question to get started.', 'QUESTION_REQUIRED');
  if (question.length > 500) {
    throw new QueryError('Keep your question under 500 characters.', 'QUESTION_TOO_LONG');
  }
  if (forbidden.test(question)) {
    throw new QueryError('Only read-only SELECT questions are allowed. Changes to the database are blocked.', 'READ_ONLY_ONLY');
  }
  return question;
}

function findDepartment(question) {
  const normalized = question.toLowerCase();
  return departments.find((department) => department.aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
  }));
}

function getLimit(question, fallback = QUERY_ROW_LIMIT) {
  const match = question.match(/\b(?:top|first|show|list|latest|last)\s+(\d{1,3})\b/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  return Math.min(Math.max(amount, 1), QUERY_ROW_LIMIT);
}

function generateQuery(input) {
  const question = cleanQuestion(input);
  const normalized = question.toLowerCase();
  const limit = getLimit(question);
  const department = findDepartment(question);

  if (/\b(?:average|avg|mean)\b/.test(normalized) && /\bsalar(?:y|ies)\b/.test(normalized) && /\bdepartment/.test(normalized)) {
    return { question, sql: templates.averageSalary, params: [limit], explanation: 'Average employee salary grouped by department.' };
  }
  if (/\b(?:count|number of|how many)\b/.test(normalized) && /\bemployees?\b/.test(normalized) && /\bdepartment/.test(normalized)) {
    return { question, sql: templates.employeeCounts, params: [limit], explanation: 'Employee totals for each department.' };
  }
  if (department && /\b(?:count|number of|how many)\b/.test(normalized) && /\bemployees?\b/.test(normalized)) {
    return { question, sql: templates.employeeCountByDepartment, params: [department.name, limit], explanation: `Employee total for ${department.name}.` };
  }
  if (/\b(?:summary|overview|total counts|how many records)\b/.test(normalized) && /\b(?:database|company|everything|all)\b/.test(normalized)) {
    return { question, sql: templates.summary, params: [], explanation: 'High-level counts across the database.' };
  }
  if (/\b(?:assignment|assignments|assigned|working on|staffing|team members?)\b/.test(normalized) && /\bprojects?\b/.test(normalized)) {
    return { question, sql: templates.assignments, params: [limit], explanation: 'Employees assigned to projects, including their roles and allocation.' };
  }
  if (/\bprojects?\b/.test(normalized)) {
    const status = projectStatuses.find((candidate) => new RegExp(`\\b${candidate.replace(' ', '\\s+')}\\b`, 'i').test(normalized));
    if (status) {
      return { question, sql: templates.projectsByStatus, params: [status, limit], explanation: `Projects with ${status} status.` };
    }
    return { question, sql: templates.projects, params: [limit], explanation: 'Project details, ordered by start date.' };
  }
  if (/\bdepartments?\b/.test(normalized) && !/\bemployees?\b/.test(normalized)) {
    return { question, sql: templates.departments, params: [limit], explanation: 'Department names, locations, and budgets.' };
  }
  if (department && /\bemployees?\b/.test(normalized)) {
    return { question, sql: templates.employeesByDepartment, params: [department.name, limit], explanation: `Employees in ${department.name}.` };
  }
  if (/\b(?:highest paid|top earners?|most paid|highest salar(?:y|ies))\b/.test(normalized)) {
    return { question, sql: templates.highestPaid, params: [limit], explanation: 'Employees ordered by salary, highest first.' };
  }
  if (/\b(?:earn(?:ing|s)?|salary|salaries|paid)\b/.test(normalized)) {
    const comparison = normalized.match(/\b(?:above|over|greater than|more than|at least|below|under|less than|at most)\s+\$?([\d,]+)\b/);
    if (comparison) {
      const amount = Number(comparison[1].replace(/,/g, ''));
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) {
        throw new QueryError('Use a salary amount between 0 and 100,000,000.', 'INVALID_AMOUNT');
      }
      const phrase = comparison[0].toLowerCase();
      const operator = /\b(?:above|over|greater than|more than)\b/.test(phrase) ? '>'
        : /\bat least\b/.test(phrase) ? '>='
          : /\b(?:below|under|less than)\b/.test(phrase) ? '<' : '<=';
      return {
        question,
        sql: templates.employeesBySalary.replace('{operator}', operator),
        params: [amount, limit],
        explanation: `Employees with salary ${operator} ${amount.toLocaleString('en-IN')}.`
      };
    }
    if (/\b(?:employees?|people|staff)\b/.test(normalized)) {
      return { question, sql: templates.employees, params: [limit], explanation: 'Employee details, including salary.' };
    }
  }
  if (/\b(?:employees?|people|staff)\b/.test(normalized)) {
    return { question, sql: templates.employees, params: [limit], explanation: 'Employee directory, ordered by name.' };
  }

  throw new QueryError(
    'I could not map that to a supported read-only question. Try one of the examples below, such as “Show employees in Finance” or “List active projects.”',
    'QUESTION_NOT_SUPPORTED'
  );
}

function validateSelect(sql) {
  if (typeof sql !== 'string' || !/^\s*SELECT\b/i.test(sql)) {
    throw new QueryError('This request was blocked: only SELECT statements are allowed.', 'SQL_BLOCKED');
  }
  if (sql.includes(';') || sql.includes('--') || sql.includes('/*') || sql.includes('*/') || forbidden.test(sql)) {
    throw new QueryError('This request was blocked by the read-only SQL policy.', 'SQL_BLOCKED');
  }
  if (!approvedSql.has(sql)) {
    throw new QueryError('This query did not match an approved read-only template and was blocked.', 'SQL_BLOCKED');
  }
  return true;
}

class QueryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'QueryError';
    this.code = code;
  }
}

module.exports = { MAX_ROWS, QueryError, generateQuery, validateSelect };
