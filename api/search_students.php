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

$query = $_GET['query'] ?? '';

$conn = getDatabaseConnection();

$searchTerm = "%$query%";
$stmt = $conn->prepare("SELECT * FROM students WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR student_id LIKE ? OR award_number LIKE ? ORDER BY id DESC");
$stmt->bind_param("sssss", $searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm);
$stmt->execute();
$result = $stmt->get_result();

$students = [];
while ($row = $result->fetch_assoc()) {
    $students[] = [
        'id' => $row['id'],
        'firstName' => $row['first_name'],
        'lastName' => $row['last_name'],
        'studentId' => $row['student_id'],
        'email' => $row['email'],
        'department' => $row['department'],
        'course' => $row['course'],
        'year' => $row['year_level'],
        'status' => $row['status'],
        'awardNumber' => $row['award_number']
    ];
}

echo json_encode(['success' => true, 'students' => $students]);

$stmt->close();
$conn->close();
?>