# Ad-hoc scripts

One-off debugging and maintenance scripts, moved here from the backend
project root so they're out of the deployable app tree. None of these are
wired into `artisan` — they're standalone entry points that `require
bootstrap/app.php` directly for full Eloquent/DB access, meant to be run
manually with `php scripts/adhoc/<file>.php` (or piped into `artisan
tinker`) from the `backend/` directory, never as web-served endpoints.

`database_cleanup.php` in particular mutates data (deduplicates customer
phone numbers) — read it before running it against a real database, and
prefer taking a backup first.

New throwaway scripts dropped in this folder as `debug_*.php` or
`scratch_*.php` are gitignored automatically; rename or `git add -f` them
if you want to keep one under version control.
