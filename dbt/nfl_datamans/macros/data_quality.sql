-- Data quality macros for dbt
-- These macros can be used in dbt models or tests

{% macro check_column_completeness(column_name, model_name) %}
  -- Check null rate for a column
  SELECT 
    '{{ column_name }}' as column_name,
    COUNT(*) FILTER (WHERE {{ column_name }} IS NULL) as null_count,
    COUNT(*) as total_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE {{ column_name }} IS NULL) / COUNT(*), 2) as null_pct
  FROM {{ ref(model_name) }}
{% endmacro %}

{% macro check_value_ranges(model_name, column_name, min_value, max_value) %}
  -- Check if values are within expected range
  SELECT 
    COUNT(*) FILTER (WHERE {{ column_name }} < {{ min_value }} OR {{ column_name }} > {{ max_value }}) as out_of_range_count,
    COUNT(*) as total_count
  FROM {{ ref(model_name) }}
{% endmacro %}

{% macro check_season_coverage(model_name) %}
  -- Check season coverage and record counts
  SELECT 
    season,
    COUNT(DISTINCT player_id) as unique_players,
    COUNT(*) as total_records,
    MIN(week) as min_week,
    MAX(week) as max_week,
    COUNT(DISTINCT week) as unique_weeks
  FROM {{ ref(model_name) }}
  GROUP BY season
  ORDER BY season DESC
{% endmacro %}

{% macro check_duplicate_records(model_name, key_columns) %}
  -- Check for duplicate records based on key columns
  SELECT 
    {{ key_columns }},
    COUNT(*) as duplicate_count
  FROM {{ ref(model_name) }}
  GROUP BY {{ key_columns }}
  HAVING COUNT(*) > 1
{% endmacro %}

