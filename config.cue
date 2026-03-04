// shrowser configuration — validated at build time.

daemon: port: int & >0 & <65536 | *9231

repl: {
	toggleKey:      string | *"`"
	toggleModifier: string | *"ctrlKey"
	dismissKeys: [...string] | *["Escape"]
	dismissChords: [...{key: string, modifier: string}] | *[
		{key: "d", modifier:  "ctrlKey"},
		{key: "`", modifier:  "ctrlKey"},
	]
	styles: {
		bar: string | *"""
			position: fixed; bottom: 0; left: 0; right: 0; z-index: 2147483647;
			background: #282c34; border-top: 1px solid #666666;
			font-family: monospace; font-size: 9pt;
			"""
		input: string | *"""
			width: 97%; box-sizing: border-box;
			background: #282c34; color: #ffffff; border: none; outline: none;
			font-family: monospace; font-size: 9pt; line-height: 1.5;
			padding: 1px 0.5ex; caret-color: #ffffff;
			"""
		output: string | *"""
			margin: 0; padding: 0;
			background: #282c34; color: #eaeaea;
			font-family: monospace; font-size: 9pt;
			max-height: calc(20 * 1.4em); overflow-y: auto;
			white-space: pre-wrap; word-break: break-all;
			border-top: 1px solid #666666;
			display: none;
			user-select: text; -webkit-user-select: text;
			cursor: text;
			"""
		hint: string | *"""
			position: absolute; right: 0.5ex; bottom: 1px;
			color: #666666; font-size: 8pt;
			pointer-events: none;
			"""
		tableCss: string | *"""
			#shrowser-cmdbar .shrowser-output {
			  scrollbar-width: thin;
			  scrollbar-color: #666666 #282c34;
			}
			#shrowser-cmdbar .shrowser-table {
			  width: 100%; border-spacing: 0; table-layout: fixed;
			  font-family: monospace; font-size: 9pt; color: #eaeaea;
			}
			#shrowser-cmdbar .shrowser-table td {
			  padding: 0 0.5ex; overflow: hidden; text-overflow: ellipsis;
			  white-space: nowrap; height: 1.4em; line-height: 1.4em;
			}
			#shrowser-cmdbar .shrowser-table tr:nth-child(even) {
			  background: #1d1f21;
			}
			#shrowser-cmdbar .shrowser-table .col-idx { width: 4ex; color: #f0c674; }
			#shrowser-cmdbar .shrowser-table .col-url { color: #b6bd68; }
			#shrowser-cmdbar .shrowser-table .col-active { width: 3ex; text-align: center; color: #b294bb; }
			#shrowser-cmdbar .shrowser-table .col-pinned { width: 4ex; text-align: center; color: #8abeb7; }
			#shrowser-cmdbar .shrowser-table .col-command { width: 14ex; color: #f0c674; }
			#shrowser-cmdbar .shrowser-table .col-usage { width: 22ex; color: #82a2be; }
			#shrowser-cmdbar .shrowser-table .col-desc { color: #c4c8c6; }
			#shrowser-cmdbar .shrowser-text {
			  padding: 2px 0.5ex; white-space: pre-wrap; word-break: break-all;
			  font-family: monospace; font-size: 9pt; color: #eaeaea;
			}
			"""
	}
}

build: target: string | *"firefox115"
