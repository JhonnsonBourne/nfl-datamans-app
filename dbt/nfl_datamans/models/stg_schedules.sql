{{ config(materialized='view') }}

-- Simple staging model that currently just passes through the raw schedules source.
-- You can later add explicit casts/renames and derived columns.

select
  *
from {{ source('nflverse', 'schedules') }}
