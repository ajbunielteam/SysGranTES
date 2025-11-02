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
$result = $conn->query("SELECT * FROM students ORDER BY id DESC");

$students = [];
while ($row = $result->fetch_assoc()) {
    // Check column names - handle both snake_case and camelCase
    $isIndigenous = isset($row['is_indigenous']) ? (bool)$row['is_indigenous'] : 
                   (isset($row['isIndigenous']) ? (bool)$row['isIndigenous'] : false);
    $isPwd = isset($row['is_pwd']) ? (bool)$row['is_pwd'] : 
             (isset($row['isPwd']) ? (bool)$row['isPwd'] : false);
    
    // Check for place field (might be 'place', 'from', 'origin', or 'address')
    $place = $row['place'] ?? $row['from'] ?? $row['origin'] ?? $row['address'] ?? '';
    
    // Check for province and municipality fields (from applications)
    $province = $row['province'] ?? '';
    $municipality = $row['municipality'] ?? '';
    
    $students[] = [
        'id' => $row['id'],
        'firstName' => $row['first_name'] ?? '',
        'lastName' => $row['last_name'] ?? '',
        'studentId' => $row['student_id'] ?? '',
        'email' => $row['email'] ?? '',
        'department' => $row['department'] ?? '',
        'course' => $row['course'] ?? '',
        'year' => $row['year_level'] ?? '',
        'yearLevel' => $row['year_level'] ?? '',
        'status' => $row['status'] ?? 'active',
        'student_status' => $row['status'] ?? 'active',
        'awardNumber' => $row['award_number'] ?? '',
        'award_number' => $row['award_number'] ?? '',
        'place' => $place,
        'from' => $place,
        'origin' => $place,
        'province' => $province,
        'municipality' => $municipality,
        'isIndigenous' => $isIndigenous,
        'is_indigenous' => $isIndigenous,
        'isPwd' => $isPwd,
        'is_pwd' => $isPwd
    ];
}

if ($conn->error) {
    echo json_encode([
        'success' => false, 
        'message' => 'Database error: ' . $conn->error,
        'students' => []
    ]);
} else {
    echo json_encode([
        'success' => true, 
        'students' => $students,
        'count' => count($students)
    ]);
}

$conn->close();
?>