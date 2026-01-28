-- Add sort_order column to inspection_templates for drag-and-drop reordering
ALTER TABLE inspection_templates
ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Index for efficient ordering within location + frequency groups
CREATE INDEX idx_templates_sort_order
  ON inspection_templates (location_id, frequency, sort_order);
