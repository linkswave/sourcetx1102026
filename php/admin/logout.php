<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/auth.php';

logout_admin();
redirect('/admin/login');
