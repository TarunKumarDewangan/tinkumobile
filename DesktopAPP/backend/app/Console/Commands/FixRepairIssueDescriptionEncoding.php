<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixRepairIssueDescriptionEncoding extends Command
{
    /**
     * The UppercaseStrings trait used to re-encode the already-JSON-encoded
     * issue_description column on every save (fixed in the trait itself), so
     * any repair saved more than once before the fix has issue_description
     * wrapped in extra layers of JSON-string-encoding — sometimes as nested
     * strings inside an otherwise-valid-looking array (from an earlier,
     * shallower attempt at this same fix). This recursively unwraps any
     * JSON-encoded string wherever it appears — top-level or nested inside
     * array elements — down to plain leaf strings, then re-saves once clean.
     */
    protected $signature = 'repairs:fix-issue-description-encoding {--dry-run}';

    protected $description = 'Un-corrupt double/triple-encoded issue_description values on repair_requests';

    /**
     * Repeatedly json_decode $value (and, if it's an array, each of its
     * elements) as long as doing so still changes something. Bounded so
     * malformed data can't loop forever.
     */
    private function deepUnwrap($value, int $maxPasses = 50): array
    {
        $passes = 0;
        $changed = true;

        while ($changed && $passes < $maxPasses) {
            $changed = false;
            $passes++;

            if (is_string($value)) {
                $decoded = json_decode($value, true);
                if ($decoded !== null || $value === 'null') {
                    $value = $decoded;
                    $changed = true;
                }
            } elseif (is_array($value)) {
                foreach ($value as $i => $item) {
                    if (is_string($item)) {
                        $decoded = json_decode($item, true);
                        if ($decoded !== null || $item === 'null') {
                            $value[$i] = $decoded;
                            $changed = true;
                        }
                    } elseif (is_array($item)) {
                        $value[$i] = $this->deepUnwrap($item, $maxPasses - $passes);
                        $changed = true; // conservatively re-check the parent once more
                    }
                }
            }
        }

        // Flatten any nested arrays that resulted from unwrapping (e.g. a
        // string element that itself decoded into an array of strings).
        $flat = [];
        $flattenInto = function ($v) use (&$flat, &$flattenInto) {
            if (is_array($v)) {
                foreach ($v as $item) $flattenInto($item);
            } elseif (is_string($v) && trim($v) !== '') {
                $flat[] = $v;
            }
        };
        $flattenInto($value);

        return $flat;
    }

    public function handle()
    {
        $dryRun = $this->option('dry-run');

        $repairs = DB::table('repair_requests')->select('id', 'issue_description')->get();
        $fixed = 0;
        $skipped = 0;

        foreach ($repairs as $repair) {
            $original = $repair->issue_description;
            $clean = $this->deepUnwrap($original);

            // Compare against what this column would look like if it were
            // already in its final, correctly-encoded form.
            if ($original === json_encode($clean) || empty($clean)) {
                $skipped++;
                continue;
            }

            $this->line("Repair #{$repair->id}: " . json_encode($clean));

            if (!$dryRun) {
                DB::table('repair_requests')->where('id', $repair->id)->update([
                    'issue_description' => json_encode($clean),
                ]);
            }
            $fixed++;
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '') . "Fixed: {$fixed}, Already clean: {$skipped}");
        return 0;
    }
}
