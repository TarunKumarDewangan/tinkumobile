$repairs = \App\Models\RepairRequest::all();
foreach ($repairs as $repair) {
    $repair->postToLedger();
}
echo "Done\n";
