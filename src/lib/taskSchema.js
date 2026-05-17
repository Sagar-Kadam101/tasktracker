// src/lib/taskSchema.js
// Single source of truth for what columns a task has when being created/imported.
// When the app grows, update THIS file — templates, importers, and validators all
// automatically reflect the change.

export const TASK_SCHEMA = [
  {
    column: "title",
    required: true,
    type: "text",
    description: "Task title — what needs to be done",
    example: "Reconcile bank statements for August",
  },
  {
    column: "description",
    required: false,
    type: "text",
    description: "Optional longer description",
    example: "Match all bank entries with cash book",
  },
  {
    column: "assignee_email",
    required: false,
    type: "email",
    description: "Email of team member — must match an existing user",
    example: "sagar@yourcompany.com",
  },
  {
    column: "reviewer_email",
    required: false,
    type: "email",
    description: "Email of reviewer — must match an existing user",
    example: "manager@yourcompany.com",
  },
  {
    column: "priority",
    required: false,
    type: "enum",
    values: ["High", "Medium", "Low"],
    default: "Medium",
    description: "One of: High, Medium, Low",
    example: "High",
  },
  {
    column: "category",
    required: false,
    type: "text",
    description: "Category name (must match a category in the workspace)",
    example: "Finance",
  },
  {
    column: "status",
    required: false,
    type: "enum",
    values: ["To Do", "In Progress", "In Review", "Done"],
    default: "To Do",
    description: "Initial status",
    example: "To Do",
  },
  {
    column: "due_date",
    required: false,
    type: "date",
    description: "Due date in YYYY-MM-DD format",
    example: "2026-08-15",
  },
  {
    column: "review_tat_days",
    required: false,
    type: "number",
    description: "Number of days reviewer has to complete review",
    example: "2",
  },
  {
    column: "visibility",
    required: false,
    type: "enum",
    values: ["public", "private"],
    default: "public",
    description:
      "Visibility: public (everyone sees) or private (only assignee/reviewer/admin)",
    example: "public",
  },
  {
    column: "task_type",
    required: false,
    type: "enum",
    values: ["One-time", "Recurring"],
    default: "One-time",
    description: "Type of task",
    example: "One-time",
  },
  {
    column: "recurrence",
    required: false,
    type: "enum",
    values: ["None", "Daily", "Weekly", "Fortnightly", "Monthly"],
    default: "None",
    description: "Recurrence frequency (only used if task_type is Recurring)",
    example: "None",
  },
  {
    column: "tags",
    required: false,
    type: "text",
    description: "Comma-separated tags",
    example: "urgent, client-X",
  },
  {
    column: "blocked_by_title",
    required: false,
    type: "text",
    description:
      "Title of another task in the same import that blocks this one (sequential dependency)",
    example: "Collect bank statements",
  },
];

// Helper: return just the column names in order
export function getColumnNames() {
  return TASK_SCHEMA.map((f) => f.column);
}

// Helper: return required column names
export function getRequiredColumns() {
  return TASK_SCHEMA.filter((f) => f.required).map((f) => f.column);
}

// Helper: get schema entry for a column
export function getFieldSchema(column) {
  return TASK_SCHEMA.find((f) => f.column === column);
}

// Helper: validate a single row, returns { ok, errors, warnings, payload }
// `lookup` is a helper passed by the caller for resolving emails → user ids etc.
export function validateRow(row, lookup) {
  const errors = [];
  const warnings = [];
  const payload = {};

  TASK_SCHEMA.forEach((field) => {
    const raw = (row[field.column] ?? "").toString().trim();

    // Required check
    if (field.required && !raw) {
      errors.push(`${field.column} is required`);
      return;
    }

    if (!raw) {
      // Empty optional field — apply default if defined
      if (field.default !== undefined) {
        payload[field.column] = field.default;
      }
      return;
    }

    // Type checks
    if (field.type === "enum") {
      // Case-insensitive enum matching
      const match = field.values.find(
        (v) => v.toLowerCase() === raw.toLowerCase()
      );
      if (!match) {
        errors.push(
          `${field.column} "${raw}" is invalid (use: ${field.values.join(
            ", "
          )})`
        );
        return;
      }
      payload[field.column] = match;
    } else if (field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        errors.push(`${field.column} "${raw}" should be YYYY-MM-DD format`);
        return;
      }
      const d = new Date(raw);
      if (isNaN(d.getTime())) {
        errors.push(`${field.column} "${raw}" is not a valid date`);
        return;
      }
      payload[field.column] = raw;
    } else if (field.type === "number") {
      const n = parseInt(raw, 10);
      if (isNaN(n)) {
        errors.push(`${field.column} "${raw}" should be a number`);
        return;
      }
      payload[field.column] = n;
    } else if (field.type === "email") {
      // Look up email → user
      const user = lookup?.findMemberByEmail?.(raw);
      if (!user) {
        warnings.push(
          `${field.column} "${raw}" not found in team — will leave unassigned`
        );
      } else {
        // Translate to user id
        if (field.column === "assignee_email") payload.assignee_id = user.id;
        else if (field.column === "reviewer_email")
          payload.reviewer_id = user.id;
      }
    } else {
      // text — just pass through
      payload[field.column] = raw;
    }
  });

  return { ok: errors.length === 0, errors, warnings, payload };
}
