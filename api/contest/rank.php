<?php
    //? |-----------------------------------------------------------------------------------------------|
    //? |  /api/contest/rank.php                                                                           |
    //? |                                                                                               |
    //? |  Copyright (c) 2018-2019 Belikhun. All right reserved                                         |
    //? |  Licensed under the MIT License. See LICENSE in the project root for license information.     |
    //? |-----------------------------------------------------------------------------------------------|

    // SET PAGE TYPE
    define("PAGE_TYPE", "API");
    
    require_once $_SERVER["DOCUMENT_ROOT"] ."/lib/ratelimit.php";
    require_once $_SERVER["DOCUMENT_ROOT"] ."/lib/belibrary.php";
    require_once $_SERVER["DOCUMENT_ROOT"] ."/data/config.php";

    if ($config["publish"] !== true || $config["viewRank"] !== true)
        stop(0, "Thành công!", 200, Array(
            "list" => Array(),
            "rank" => Array()
        ));

    require_once $_SERVER["DOCUMENT_ROOT"] ."/data/xmldb/account.php";
    require_once $_SERVER["DOCUMENT_ROOT"] ."/lib/logParser.php";

    $logDir = glob($config["logDir"] ."/*.log");
    $res = Array();
    $list = Array();

    foreach ($logDir as $i => $log) {
        $data = ((new logParser($log, LOGPARSER_MODE_MINIMAL)) -> parse())["header"];
        $filename = $data["file"]["logFilename"];
        $user = $data["user"];

        if ($config["viewRankTask"] === true) {
            $list[$i] = $data["problem"];
            $res[$user]["status"][$data["problem"]] = $data["status"];
            $res[$user]["point"][$data["problem"]] = $data["point"];
            $res[$user]["logFile"][$data["problem"]] = ($config["viewLog"] === true) ? $filename : null;
        }

        $res[$user]["username"] = $user;
        $res[$user]["name"] = getUserData($user)["name"] ?: null;

        if (!isset($res[$user]["total"]))
            $res[$user]["total"] = 0;
            
        $res[$user]["total"] += $data["point"];
    }

    $nlr = arrayRemDub($list);
    $list = ((count($nlr) > 0) ? $nlr : Array());

    // Sort user by total point
    usort($res, function($a, $b) {
        $a = $a["total"];
        $b = $b["total"];
    
        if ($a === $b)
            return 0;

        return ($a > $b) ? -1 : 1;
    });
    
    stop(0, "Thành công!", 200, $returnData = Array (
        "list" => $list,
        "rank" => $res
    ), true);