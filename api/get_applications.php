<?php
// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 3600');
    http_response_code(200);
    exit();
}

// Set CORS headers for actual request
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

require_once '../config/database.php';

$conn = getDatabaseConnection();

// Check if applications table exists
$tableCheck = $conn->query("SHOW TABLES LIKE 'applications'");
if ($tableCheck->num_rows == 0) {
    echo json_encode([
        'success' => true,
        'applications' => []
    ]);
    $conn->close();
    exit;
}

// Get all applications - check if submitted_at column exists first
$columnCheck = $conn->query("SHOW COLUMNS FROM applications LIKE 'submitted_at'");
$hasSubmittedAt = $columnCheck && $columnCheck->num_rows > 0;

if ($hasSubmittedAt) {
    $result = $conn->query("SELECT * FROM applications ORDER BY submitted_at DESC");
} else {
    // Fallback to created_at or id if submitted_at doesn't exist
    $createdAtCheck = $conn->query("SHOW COLUMNS FROM applications LIKE 'created_at'");
    if ($createdAtCheck && $createdAtCheck->num_rows > 0) {
        $result = $conn->query("SELECT * FROM applications ORDER BY created_at DESC");
    } else {
        $result = $conn->query("SELECT * FROM applications ORDER BY id DESC");
    }
}

$applications = [];
while ($row = $result->fetch_assoc()) {
    $appData = [
        'id' => $row['id'],
        'studentId' => $row['student_id'],
        'lastName' => $row['last_name'],
        'givenName' => $row['given_name'],
        'extName' => $row['ext_name'],
        'sex' => $row['sex'],
        'birthdate' => $row['birthdate'],
        'programName' => $row['program_name'],
        'yearLevel' => $row['year_level'],
        'fatherName' => $row['father_name'],
        'motherName' => $row['mother_name'],
        'familyMonthlyIncome' => floatval($row['family_monthly_income']),
        'incomeRange' => $row['income_range'],
        'province' => $row['province'],
        'municipality' => $row['municipality'],
        'streetBarangay' => $row['street_barangay'],
        'zipCode' => $row['zip_code'],
        'contactNumber' => $row['contact_number'],
        'email' => $row['email'],
        'isPwd' => (bool)$row['is_pwd'],
        'isIndigenous' => (bool)$row['is_indigenous'],
        'status' => $row['status'],
        'submittedAt' => isset($row['submitted_at']) ? $row['submitted_at'] : (isset($row['created_at']) ? $row['created_at'] : null),
        'photoPath' => isset($row['photo_path']) ? $row['photo_path'] : null
    ];
    
    // Add password if column exists
    if (isset($row['password'])) {
        $appData['password'] = $row['password'];
    }
    
    $applications[] = $appData;
}

echo json_encode([
    'success' => true,
    'applications' => $applications
]);

$conn->close();
?>

