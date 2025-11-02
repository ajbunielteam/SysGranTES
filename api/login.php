<?php
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
$role = $data['role'] ?? '';
$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$identifier = $data['identifier'] ?? '';

$conn = getDatabaseConnection();

if ($role === 'admin') {
    // Admin login
    $stmt = $conn->prepare("SELECT * FROM admin_credentials WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $admin = $result->fetch_assoc();
        if ($password === $admin['password']) { // In production, use password_verify()
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => 'admin',
                    'name' => 'Administrator',
                    'email' => $admin['email'],
                    'role' => 'admin'
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid password']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Admin not found']);
    }
    $stmt->close();
} elseif ($role === 'student') {
    // Student login - search by email, student_id, or award_number
    $stmt = $conn->prepare("SELECT * FROM students WHERE email = ? OR student_id = ? OR award_number = ?");
    $stmt->bind_param("sss", $identifier, $identifier, $identifier);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $student = $result->fetch_assoc();
        if ($password === $student['password']) { // In production, use password_verify()
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $student['id'],
                    'name' => $student['first_name'] . ' ' . $student['last_name'],
                    'email' => $student['email'],
                    'role' => 'student',
                    'studentData' => [
                        'id' => $student['id'],
                        'firstName' => $student['first_name'],
                        'lastName' => $student['last_name'],
                        'studentId' => $student['student_id'],
                        'email' => $student['email'],
                        'awardNumber' => $student['award_number'],
                        'department' => $student['department'],
                        'course' => $student['course'],
                        'year' => $student['year_level'],
                        'place' => $student['place'],
                        'photo' => $student['photo'],
                        'isIndigenous' => $student['is_indigenous'],
                        'isPwd' => $student['is_pwd'],
                        'status' => $student['status'],
                        'applicationStatus' => $student['application_status'],
                        'registered' => $student['registered_date']
                    ]
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid password']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Student not found']);
    }
    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid role']);
}

$conn->close();
?>