-- CreateFunction: check_global_filters
-- This function evaluates global filters against EntityData.data
-- Used by PowerSync sync rules to filter data at sync time

CREATE OR REPLACE FUNCTION check_global_filters(
  entity_data JSONB,
  global_filters JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  filter JSONB;
  field_slug TEXT;
  field_type TEXT;
  op TEXT;
  filter_value TEXT;
  filter_value2 TEXT;
  data_value TEXT;
  data_num NUMERIC;
  filter_num NUMERIC;
  filter_num2 NUMERIC;
BEGIN
  -- If no filters or empty array, return true (show all)
  IF global_filters IS NULL OR jsonb_typeof(global_filters) != 'array' OR jsonb_array_length(global_filters) = 0 THEN
    RETURN TRUE;
  END IF;

  -- If entity_data is null, filters can't match
  IF entity_data IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check each filter (AND logic - all must pass)
  FOR filter IN SELECT * FROM jsonb_array_elements(global_filters)
  LOOP
    field_slug := filter->>'fieldSlug';
    field_type := LOWER(COALESCE(filter->>'fieldType', 'text'));
    op := LOWER(COALESCE(filter->>'operator', 'equals'));
    filter_value := filter->>'value';
    filter_value2 := filter->>'value2';
    data_value := entity_data->>field_slug;

    -- Handle isEmpty/isNotEmpty operators
    IF op = 'isempty' THEN
      IF data_value IS NOT NULL AND data_value != '' AND data_value != 'null' THEN
        RETURN FALSE;
      END IF;
      CONTINUE;
    END IF;

    IF op = 'isnotempty' THEN
      IF data_value IS NULL OR data_value = '' OR data_value = 'null' THEN
        RETURN FALSE;
      END IF;
      CONTINUE;
    END IF;

    -- For other operators, if data_value is null, filter fails
    IF data_value IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Text-based operators
    IF field_type IN ('text', 'textarea', 'richtext', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password', 'select', 'relation', 'api-select') THEN
      CASE op
        WHEN 'equals' THEN
          IF data_value != filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'contains' THEN
          IF data_value NOT ILIKE '%' || filter_value || '%' THEN
            RETURN FALSE;
          END IF;
        WHEN 'startswith' THEN
          IF data_value NOT ILIKE filter_value || '%' THEN
            RETURN FALSE;
          END IF;
        WHEN 'endswith' THEN
          IF data_value NOT ILIKE '%' || filter_value THEN
            RETURN FALSE;
          END IF;
        ELSE
          -- Unknown operator, skip
          NULL;
      END CASE;

    -- Numeric operators
    ELSIF field_type IN ('number', 'currency', 'percentage', 'rating', 'slider') THEN
      BEGIN
        data_num := data_value::NUMERIC;
        filter_num := filter_value::NUMERIC;
        IF filter_value2 IS NOT NULL THEN
          filter_num2 := filter_value2::NUMERIC;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Can't convert to number, skip this filter
        CONTINUE;
      END;

      CASE op
        WHEN 'equals' THEN
          IF data_num != filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'gt' THEN
          IF data_num <= filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'gte' THEN
          IF data_num < filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'lt' THEN
          IF data_num >= filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'lte' THEN
          IF data_num > filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'between' THEN
          IF data_num < filter_num OR data_num > filter_num2 THEN
            RETURN FALSE;
          END IF;
        ELSE
          NULL;
      END CASE;

    -- Date operators
    ELSIF field_type IN ('date', 'datetime', 'time') THEN
      CASE op
        WHEN 'equals' THEN
          IF data_value != filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'gt' THEN
          IF data_value <= filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'gte' THEN
          IF data_value < filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'lt' THEN
          IF data_value >= filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'lte' THEN
          IF data_value > filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'between' THEN
          IF data_value < filter_value OR data_value > filter_value2 THEN
            RETURN FALSE;
          END IF;
        ELSE
          NULL;
      END CASE;

    -- Boolean operators
    ELSIF field_type = 'boolean' THEN
      IF op = 'equals' THEN
        IF (data_value = 'true' OR data_value = '1') != (filter_value = 'true' OR filter_value = '1') THEN
          RETURN FALSE;
        END IF;
      END IF;

    -- Default: text comparison
    ELSE
      IF op = 'equals' AND data_value != filter_value THEN
        RETURN FALSE;
      ELSIF op = 'contains' AND data_value NOT ILIKE '%' || filter_value || '%' THEN
        RETURN FALSE;
      END IF;
    END IF;

  END LOOP;

  -- All filters passed
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create index to speed up the function (optional, for large datasets)
-- CREATE INDEX IF NOT EXISTS idx_entity_settings_gin ON "Entity" USING gin ((settings::jsonb));
