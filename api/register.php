<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$firstName = $data['firstName'] ?? '';
$lastName = $data['lastName'] ?? '';
$studentId = $data['studentId'] ?? '';
$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$department = $data['department'] ?? '';
$course = $data['course'] ?? '';
$year = $data['year'] ?? '';
$awardNumber = $data['awardNumber'] ?? '';
$place = $data['place'] ?? '';
$isIndigenous = isset($data['isIndigenous']) && $data['isIndigenous'] ? 1 : 0;
$isPwd = isset($data['isPwd']) && $data['isPwd'] ? 1 : 0;

$conn = getDatabaseConnection();

// Debug: Log received data (remove this after testing)
error_log("Registration data received: " . print_r($data, true));

// Check if email exists

// Check if email exists
$stmt = $conn->prepare("SELECT id FROM students WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'Email already exists']);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

// Check if student ID exists
$stmt = $conn->prepare("SELECT id FROM students WHERE student_id = ?");
$stmt->bind_param("s", $studentId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'Student ID already exists']);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

// Check if award number exists (if provided)
if (!empty($awardNumber)) {
    $stmt = $conn->prepare("SELECT id FROM students WHERE award_number = ?");
    $stmt->bind_param("s", $awardNumber);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Award number already exists']);
        $stmt->close();
        $conn->close();
        exit;
    }
    $stmt->close();
}

// Insert new student
$stmt = $conn->prepare("INSERT INTO students (first_name, last_name, student_id, email, password, department, course, year_level, award_number, place, is_indigenous, is_pwd, status, registered_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())");
$stmt->bind_param("ssssssssssii", $firstName, $lastName, $studentId, $email, $password, $department, $course, $year, $awardNumber, $place, $isIndigenous, $isPwd);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Registration successful',
        'id' => $conn->insert_id
    ]);
} else {
    $error = $stmt->error ? $stmt->error : $conn->error;
    echo json_encode([
        'success' => false, 
        'message' => 'Registration failed: ' . $error,
        'sql_error' => $conn->error,
        'stmt_error' => $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>