{{ config(materialized='view') }}

-- Simple staging model that currently just passes through the raw player_stats source.
-- You can later add explicit casts/renames once you lock in the warehouse schema.

select
  *
from {{ source('nflverse', 'player_stats') }}
