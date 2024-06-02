<?php
	//? |-----------------------------------------------------------------------------------------------|
	//? |  /modules/logParser.php                                                                       |
	//? |                                                                                               |
	//? |  Copyright (c) 2018-2021 Belikhun. All right reserved                                         |
	//? |  Licensed under the MIT License. See LICENSE in the project root for license information.     |
	//? |-----------------------------------------------------------------------------------------------|

	require_once $_SERVER["DOCUMENT_ROOT"] ."/libs/belibrary.php";
	require_once $_SERVER["DOCUMENT_ROOT"] ."/modules/problem.php";

	class LogParseErrorException extends BLibException {
		public function __construct(String $file, String $message, $data) {
			$file = getRelativePath($file);
			parent::__construct(47, "LogParser().parse({$file}): {$message}", 500, Array( "file" => $file, "data" => $data ));
		}
	}

	/**
	 * Parse all the log files
	 */
	define("LOGPARSER_MODE_FULL", "f");

	/**
	 * Parse the log's filename and header only
	 */
	define("LOGPARSER_MODE_MINIMAL", "m");

	/**
	 * A module to parse Themis generated log files
	 * 
	 * @package logParser
	 */
	class logParser {

		/**
		 *
		 * Parse log file generated by Themis
		 *
		 * @param    logPath    Path to log file
		 * @param    mode       Specify parser mode
		 * @return   Array      Contain parsed data
		 *
		 */
		public function __construct(String $logPath, String $mode = LOGPARSER_MODE_MINIMAL) {
			if (!file_exists($logPath))
				throw new Error("logParser($logPath): File does not exist", 44);

			$this -> logPath = $logPath;
			$this -> mode = $mode;
			$this -> logIsFailed = false;
			$this -> passed = 0;
			$this -> failed = 0;
			$this -> blankLinePos = 3;
		}

		public function parse() {
			try {
				$file = file($this -> logPath, FILE_IGNORE_NEW_LINES);
				$header = $this -> __parseHeader($file);
	
				if ($this -> mode === LOGPARSER_MODE_FULL) {
					$testResult = $this -> __parseTestResult($file);
					$header["testPassed"] = $this -> passed;
					$header["testFailed"] = $this -> failed;
	
					if ($header["testPassed"] > 0 && $header["testFailed"] === 0)
						$header["status"] = "correct";
				} else
					$testResult = Array();
	
				return Array(
					"header" => $header,
					"test" => $testResult
				);
			} catch(Exception $e) {
				throw new LogParseErrorException($this -> logPath, $e -> getMessage(), Array(
					"code" => $e -> getCode(),
					"message" => $e -> getMessage(),
					"file" => $e -> getFile(),
					"line" => $e -> getLine(),
					"target" => $this -> logPath
				));
			} catch(Error $e) {
				throw new LogParseErrorException($this -> logPath, $e -> getMessage(), Array(
					"code" => $e -> getCode(),
					"message" => $e -> getMessage(),
					"file" => $e -> getFile(),
					"line" => $e -> getLine(),
					"target" => $this -> logPath
				));
			}
		}

		private function __parseHeader($file) {
			$data = Array(
				"status" => null,
				"user" => null,
				"problem" => null,
				"point" => 0,
				"testPassed" => 0,
				"testFailed" => 0,
				"description" => Array(),
				"error" => Array(),
				"file" => Array(
					"base" => null,
					"name" => null,
					"extension" => null,
					"logFilename" => pathinfo($this -> logPath, PATHINFO_FILENAME),
					"lastModify" => filemtime($this -> logPath)
				)
			);

			$firstLine = $file[0];
			$l1matches = [];

			if (preg_match_all("/(.+)‣(.+): ℱ (.+\w)/m", $firstLine, $l1matches, PREG_SET_ORDER, 0)) {
				// Compile error, so log file status
				// is failed
				// Example: user1‣bai1: ℱ Dịch lỗi

				$data["status"] = "failed";
				$data["point"] = 0;
				$data["description"] = [$l1matches[0][3]];
				$this -> logIsFailed = true;

				//? error detail start from line 3
				for ($i = 2; $i < count($file); $i++)
					array_push($data["error"], $file[$i]);
				
			} else if (preg_match_all("/(.+)‣(.+): Chưa chấm/m", $firstLine, $l1matches, PREG_SET_ORDER, 0)) {
				// The judging process is cancelled by themis,
				// so log file status is skipped
				// Example: admin‣bai3: Chưa chấm

				$data["status"] = "skipped";
				$data["point"] = 0;
				$data["description"] = ["Chưa chấm"];
				$this -> logIsFailed = true;
			} else if (preg_match_all("/(.+)‣(.+): ∄ Không có bài/m", $firstLine, $l1matches, PREG_SET_ORDER, 0)) {
				// I don't have much information about
				// this
				// Example: 19nguyenthithudiem‣GHH: ∄ Không có bài

				$data["status"] = "skipped";
				$data["point"] = 0;
				$data["description"] = ["Không có bài"];
			} else if (preg_match_all("/(.+)‣(.+): (.+\w)/m", $firstLine, $l1matches, PREG_SET_ORDER, 0)) {
				// Compile success, we check the submission
				// point to determine the status.
				// It can be "accepted" or "passed"
				// Example: admin‣aromatic: 20,00

				$data["point"] = $this -> __f($l1matches[0][3]);
				$data["status"] = ($data["point"] == 0) ? "accepted" : "passed";
				
				for ($i = 2; $i < count($file); $i++) {
					//? Break on blank line
					if (empty($file[$i])) {
						$this -> blankLinePos = $i;
						break;
					}

					array_push($data["description"],  $file[$i]);
				}
			} else {
				// Unknown format, we will set status to unknown
				// and ignore this file

				$data["status"] = "unknown";
				$data["point"] = 0;
				$data["description"] = [
					"Định dạng file nhật ký không rõ!",
					"Nếu bạn thấy đây là một lỗi, hãy thông báo cho quản trị viên của bạn hoặc tạo một báo cáo lỗi trên trang Github của dự án!"
				];
			
				// We will stop executing for now
				// to prevent any error that may
				// occur in the code bellow
				return $data;
			}

			//! Remove all weird characters found in the username and problem id
			$data["user"] = trim($l1matches[0][1], " \t\n\r\0\x0B﻿");
			$data["problem"] = trim($l1matches[0][2], " \t\n\r\0\x0B﻿");

			if (isset($file[1])) {
				$problemFileInfo = pathinfo($file[1]);
				$data["file"]["base"] = $problemFileInfo["filename"];
				$data["file"]["name"] = $problemFileInfo["basename"];
				$data["file"]["extension"] = isset($problemFileInfo["extension"])
					? $problemFileInfo["extension"]
					: null;
			} else {
				$problemFileInfo = parseLogName($this -> logPath);

				if ($problemFileInfo) {
					$data["file"]["base"] = $problemFileInfo["problem"];
					$data["file"]["name"] = $problemFileInfo["name"];
					$data["file"]["extension"] = $problemFileInfo["extension"];
				}
			}

			return $data;
		}

		private function __parseTestResult($file) {
			if ($this -> logIsFailed === true)
				return Array();

			$this -> passed = 0;
			$this -> failed = 0;
			$data = Array();
			$lineData = null;
			$lineInitTemplate = Array(
				"status" => "passed",
				"test" => null,
				"point" => 0,
				"runtime" => 0,
				"detail" => Array(),
				"other" => Array(
					"output" => null,
					"answer" => null,
					"error" => null,
				)
			);

			// Test result often start after one blank line
			// in the log file
			for ($i = $this -> blankLinePos; $i < count($file); $i++) {
				$line = $file[$i];

				if (empty($line))
					continue;

				$lineParsed = [];
				if (preg_match_all("/.+‣.+‣(.+): (.+|\d+)/m", $line, $lineParsed, PREG_SET_ORDER, 0)) {
					// Line match begin of test data format
					// Example: bvquoc11‣CONTACT‣test002: 0.00

					if (!empty($lineData))
						array_push($data, $lineData);

					$lineData = $lineInitTemplate;
					$lineData["test"] = $lineParsed[0][1];
					$lineData["point"] = $this -> __f($lineParsed[0][2]);

					if ($lineData["point"] == 0) {
						$lineData["status"] = "accepted";
						$this -> failed++;
					} else {
						$lineData["status"] = "passed";
						$this -> passed++;
					}

				} else if (preg_match_all("/.+ ≈ (.+) .+/m", $line, $lineParsed, PREG_SET_ORDER, 0))
					// Line match runtime format
					// Example: Thời gian ≈ 0.013780820 giây

					$lineData["runtime"] = $this -> __f($lineParsed[0][1]);

				else if (preg_match_all("/.*Output.*: ((.+)(?=\.)|(.+))/m", $line, $lineParsed, PREG_SET_ORDER, 0))
					// Line match output data format
					// Example: Output: 6.

					$lineData["other"]["output"] = $lineParsed[0][1];

				else if (preg_match_all("/.*Answer.*: ((.+)(?=\.)|(.+))/m", $line, $lineParsed, PREG_SET_ORDER, 0))
					// Line match answer data format
					// Example: Answer: 6.

					$lineData["other"]["answer"] = $lineParsed[0][1];

				else if (preg_match_all("/(Command: .+)/m", $line, $lineParsed, PREG_SET_ORDER, 0)) {
					// Line match error detail format
					// Example: Command: "GCD.exe" terminated with exit code: 3221225620 (Hexadecimal: C0000094)

					$lineData["other"]["error"] = $lineParsed[0][1];
					$lineData["status"] = "failed";
				} else
					// Else might be test detail, or some random information.
					// We don't have any specific format about this line so
					// we will push it into test detail
					array_push($lineData["detail"], $line);
			}

			if (!empty($lineData))
				array_push($data, $lineData);

			return $data;
		}

		private function __f($str) {
			if (preg_match("/^(?:.*\.|)\d+\,\d+$/m", $str))
				//? FORMAT: 000.000,000
				return round((float) str_replace(",", ".", str_replace(".", "", $str)), 3);

			if (preg_match("/^(?:.*\,|)\d+\.\d+$/m", $str))
				//? FORMAT: 000,000.000
				return round((float) str_replace(",", "", $str), 3);

			//! UNKNOWN
			return round((float) $str, 3);
		}
	}

	function parseLogName(String $path) {
		$name = basename($path);

		$parse = [];
		if (preg_match_all("/(.+)\[(.+)\]\[(.+)\]\.([^\.]+)\.?(log)?/m", $name, $parse, PREG_SET_ORDER, 0)) {
			$problemData = problemGet($parse[0][3], $_SESSION["id"] === "admin");
			$problemName = null;
			$problemPoint = null;
			
			if ($problemData !== PROBLEM_ERROR_IDREJECT && $problemData !== PROBLEM_ERROR_DISABLED) {
				$problemName = $problemData["name"];
				$problemPoint = $problemData["point"];
			}

			return Array(
				"id" => $parse[0][1],
				"user" => $parse[0][2],
				"problem" => $parse[0][3],
				"problemName" => $problemName,
				"problemPoint" => $problemPoint,
				"extension" => $parse[0][4],
				"name" => $parse[0][3] .".". $parse[0][4],
				"isLogFile" => isset($parse[0][5])
			);
		}

		return null;
	}