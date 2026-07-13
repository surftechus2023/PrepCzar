# Backup and Recovery

## Supabase Backups

Use Supabase managed backups for production databases. Confirm the backup schedule for the active Supabase plan and document retention windows.

## Migration Backups

Before major migrations:

1. Export or snapshot production data.
2. Confirm the migration has been tested in staging.
3. Confirm rollback steps or compensating migration.
4. Record the migration ID and operator.

## Content Export

Periodically export:

- exam tracks
- blueprint hierarchy
- topics and subtopics
- questions
- flashcards
- case vignettes
- integrity/review metadata

Admin CSV exports support content inventory, blueprint coverage, question-quality, and item-performance reports.

## Restore Testing

At least quarterly:

1. Restore a backup into a non-production Supabase project.
2. Run migrations.
3. Verify login, subscription access, practice content, and admin review pages.
4. Document restore duration and failures.

## Operational Checklist

- Confirm Supabase backup retention.
- Confirm Stripe data can reconstruct subscription state if needed.
- Confirm content exports are encrypted at rest.
- Confirm restore credentials are not stored in source control.
