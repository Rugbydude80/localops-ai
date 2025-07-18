-- Auto-Scheduling System DDL
-- Generated DDL statements for creating tables and indexes
-- Execute these statements in your PostgreSQL database

-- CREATE TABLE statements

CREATE TABLE schedule_drafts (
	id VARCHAR NOT NULL, 
	business_id INTEGER NOT NULL, 
	created_by INTEGER NOT NULL, 
	date_range_start DATE NOT NULL, 
	date_range_end DATE NOT NULL, 
	status VARCHAR, 
	ai_generated BOOLEAN, 
	generation_params JSON, 
	confidence_score FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	published_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(business_id) REFERENCES businesses (id), 
	FOREIGN KEY(created_by) REFERENCES staff (id)
)

;


CREATE TABLE draft_shift_assignments (
	id SERIAL NOT NULL, 
	draft_id VARCHAR NOT NULL, 
	shift_id INTEGER NOT NULL, 
	staff_id INTEGER NOT NULL, 
	confidence_score FLOAT, 
	reasoning TEXT, 
	is_ai_generated BOOLEAN, 
	manual_override BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(draft_id) REFERENCES schedule_drafts (id), 
	FOREIGN KEY(shift_id) REFERENCES shifts (id), 
	FOREIGN KEY(staff_id) REFERENCES staff (id)
)

;


CREATE TABLE scheduling_constraints (
	id SERIAL NOT NULL, 
	business_id INTEGER NOT NULL, 
	constraint_type VARCHAR NOT NULL, 
	constraint_value JSON NOT NULL, 
	priority VARCHAR, 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(business_id) REFERENCES businesses (id)
)

;


CREATE TABLE staff_preferences (
	id SERIAL NOT NULL, 
	staff_id INTEGER NOT NULL, 
	preference_type VARCHAR NOT NULL, 
	preference_value JSON NOT NULL, 
	priority VARCHAR, 
	effective_date DATE, 
	expiry_date DATE, 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(staff_id) REFERENCES staff (id)
)

;


CREATE TABLE schedule_notifications (
	id SERIAL NOT NULL, 
	draft_id VARCHAR NOT NULL, 
	staff_id INTEGER NOT NULL, 
	notification_type VARCHAR NOT NULL, 
	channel VARCHAR NOT NULL, 
	content TEXT NOT NULL, 
	status VARCHAR, 
	sent_at TIMESTAMP WITHOUT TIME ZONE, 
	delivered_at TIMESTAMP WITHOUT TIME ZONE, 
	external_id VARCHAR, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(draft_id) REFERENCES schedule_drafts (id), 
	FOREIGN KEY(staff_id) REFERENCES staff (id)
)

;

-- CREATE INDEX statements for optimal query performance
CREATE INDEX IF NOT EXISTS idx_schedule_drafts_business_date_range 
ON schedule_drafts (business_id, date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_schedule_drafts_status_created 
ON schedule_drafts (status, created_at);

CREATE INDEX IF NOT EXISTS idx_draft_assignments_draft_shift 
ON draft_shift_assignments (draft_id, shift_id);

CREATE INDEX IF NOT EXISTS idx_draft_assignments_staff_confidence 
ON draft_shift_assignments (staff_id, confidence_score);

CREATE INDEX IF NOT EXISTS idx_constraints_business_type_active 
ON scheduling_constraints (business_id, constraint_type, is_active);

CREATE INDEX IF NOT EXISTS idx_preferences_staff_type_active 
ON staff_preferences (staff_id, preference_type, is_active);

CREATE INDEX IF NOT EXISTS idx_preferences_date_range 
ON staff_preferences (effective_date, expiry_date);

CREATE INDEX IF NOT EXISTS idx_notifications_draft_staff 
ON schedule_notifications (draft_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_notifications_status_sent 
ON schedule_notifications (status, sent_at);

CREATE INDEX IF NOT EXISTS idx_notifications_type_channel 
ON schedule_notifications (notification_type, channel);

-- End of Auto-Scheduling System DDL
