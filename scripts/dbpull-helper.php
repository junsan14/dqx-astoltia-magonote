<?php

// Also sent over SSH via stdin; never installed on the production server.
function dbpullConfig(string $root): array
{
    require_once $root.'/vendor/autoload.php';
    $app = require $root.'/bootstrap/app.php';
    (new Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables)->bootstrap($app);
    (new Illuminate\Foundation\Bootstrap\LoadConfiguration)->bootstrap($app);
    $config = $app['config'];
    $name = $config->get('database.default');
    $db = (new Illuminate\Support\ConfigurationUrlParser)->parseConfiguration(
        $config->get('database.connections.'.$name, [])
    );
    if (($db['driver'] ?? '') !== 'mysql' || empty($db['database']) || isset($db['read']) || isset($db['write'])) {
        throw new RuntimeException('単一接続のMySQLデータベース設定が必要です。');
    }

    return [$config->get('app.env'), $db];
}

function dbpullOptions(array $db): string
{
    $path = tempnam(sys_get_temp_dir(), 'dbpull-');
    if ($path === false) {
        throw new RuntimeException('一時ファイルを作成できません。');
    }
    chmod($path, 0600);
    $values = ['user' => $db['username'] ?? '', 'password' => $db['password'] ?? '', 'default-character-set' => 'utf8mb4'];
    if (! empty($db['unix_socket'])) {
        $values += ['protocol' => 'SOCKET', 'socket' => $db['unix_socket']];
    } else {
        $values += ['protocol' => 'TCP', 'host' => $db['host'] ?? '127.0.0.1', 'port' => $db['port'] ?? 3306];
    }
    $text = "[client]\n";
    foreach ($values as $key => $value) {
        $text .= $key.'="'.strtr((string) $value, ['\\' => '\\\\', '"' => '\\"', "\n" => '\\n', "\r" => '\\r', "\t" => '\\t']).'"'."\n";
    }
    if (file_put_contents($path, $text) === false) {
        unlink($path);
        throw new RuntimeException('接続設定を書き込めません。');
    }

    return $path;
}

function dbpullRun(array $args, $input = null, $output = null): string
{
    $in = is_resource($input) ? $input : tmpfile();
    if (! is_resource($input) && $input !== null) {
        fwrite($in, $input);
        rewind($in);
    }
    $out = $output ?? tmpfile();
    $err = tmpfile();
    $process = proc_open($args, [0 => $in, 1 => $out, 2 => $err], $pipes);
    if (! is_resource($process)) {
        throw new RuntimeException('外部コマンドを開始できません。');
    }
    $status = proc_close($process);
    rewind($err);
    $error = stream_get_contents($err);
    fclose($err);
    if (! is_resource($input)) {
        fclose($in);
    }
    $result = '';
    if ($output === null) {
        rewind($out);
        $result = stream_get_contents($out);
        fclose($out);
    }
    if ($status !== 0) {
        throw new RuntimeException(basename($args[0]).' failed: '.trim($error));
    }

    return $result;
}

function dbpullDumpArgs(string $options, string $database): array
{
    $help = dbpullRun(['mysqldump', '--no-defaults', '--help']);
    $args = ['mysqldump', '--defaults-file='.$options, '--single-transaction', '--quick', '--skip-lock-tables', '--hex-blob', '--no-tablespaces', '--set-gtid-purged=OFF'];
    if (str_contains($help, 'column-statistics')) {
        $args[] = '--column-statistics=0';
    }

    // One named database: no CREATE DATABASE / USE statements.
    return [...$args, '--', $database];
}

function dbpullRemote(string $root, string $mode): int
{
    $options = null;
    try {
        [$env, $db] = dbpullConfig($root);
        if ($env !== 'production') {
            throw new RuntimeException('SSH先のAPP_ENVがproductionではありません。');
        }
        $options = dbpullOptions($db);
        if ($mode === 'check') {
            $version = trim(dbpullRun(['mysql', '--defaults-file='.$options, '--batch', '--skip-column-names', '--execute=SELECT VERSION()', '--', $db['database']]));
            dbpullDumpArgs($options, $db['database']);
            echo json_encode(['database' => $db['database'], 'version' => $version], JSON_THROW_ON_ERROR)."\n";
        } elseif ($mode === 'dump') {
            dbpullRun(dbpullDumpArgs($options, $db['database']), null, STDOUT);
        } else {
            throw new RuntimeException('Unknown mode');
        }

        return 0;
    } catch (Throwable $e) {
        fwrite(STDERR, $e->getMessage()."\n");

        return 1;
    } finally {
        if ($options !== null) {
            unlink($options);
        }
    }
}
