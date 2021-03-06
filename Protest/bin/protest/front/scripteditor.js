/* o: output
   i: input
   c: column
   a: column + [ALL]
   h: checkbox (preset)
   n: numeric (preset, min, max)
   t: text (preset)
   m: multiline */

let Script_ToolsArray = [];

let Script_PtUserColumns = null;
let Script_PtEquipColumns = null;
let Script_AdUserColumns = null;
let Script_AdWorkstationColumns = null;
let Script_AdGroupsColumns = null;
let Script_WmiClasses = null;

const Script_GetColumns = callback => {
    let pScriptTools = new Promise((resolve, reject) => {
        if (Script_ToolsArray.length > 0) {
            resolve();
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open("GET", "scripts/getscripttools", true);
        xhr.onload = () => {
            Script_ToolsArray = [];

            let lines = xhr.responseText.split("\n");
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith("#")) continue;

                let split = lines[i].split("\t");

                if (split.length == 1) { //label
                    if (split[0].length > 0)
                        Script_ToolsArray.push({ label: split[0] });

                } else if (split.length > 2) { //name
                    let newTool = {};
                    newTool.name = split[0];
                    newTool.color = split[1];
                    newTool.p = [];

                    for (let j = 2; j < split.length; j++) {
                        let s = split[j].split(",").map(o => o.trim());
                        if (s.length < 2) continue;
                        newTool.p.push(s);
                    }

                    Script_ToolsArray.push(newTool);
                }
            }
            resolve();
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let pPtUser = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "scripts/getusercolumns", true);
        xhr.onload = () => {
            Script_PtUserColumns = xhr.responseText.length > 0 ? xhr.responseText.split(String.fromCharCode(127)) : [];
            resolve();
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let pPtEquip = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "scripts/getequipcolumns", true);
        xhr.onload = () => {
            Script_PtEquipColumns = xhr.responseText.length > 0 ? xhr.responseText.split(String.fromCharCode(127)) : [];
            resolve();
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let pAdWorkstation = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "scripts/getadworkstationcolumns", true);
        xhr.onload = () => {
            Script_AdWorkstationColumns = xhr.responseText.length > 0 ? xhr.responseText.split(String.fromCharCode(127)) : [];
            resolve();
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let pAdUser = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "scripts/getadusercolumns", true);
        xhr.onload = () => {
            Script_AdUserColumns = xhr.responseText.length > 0 ? xhr.responseText.split(String.fromCharCode(127)) : [];
            resolve();
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let pAdGroup = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "scripts/getadgroupcolumn", true);
        xhr.onload = () => {
            Script_AdGroupsColumns = xhr.responseText.length > 0 ? xhr.responseText.split(String.fromCharCode(127)) : [];
            resolve();
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let pWmiClasses = new Promise((resolve, reject) => {
        if (Script_WmiClasses != null) {
            resolve();
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open("GET", "wmi_classes.json", true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                Script_WmiClasses = JSON.parse(xhr.responseText);
                resolve();
            }
        };
        xhr.onerror = () => reject();
        xhr.send();
    });

    let promises = [pScriptTools, pPtUser, pPtEquip, pAdWorkstation, pAdUser, pAdGroup, pWmiClasses];
    Promise.all(promises).then(() => { callback(); });
};

class ScriptEditor extends Window {
    constructor(args) {
        super([64, 64, 64]);

        this.AddCssDependencies("scripts.css");
        this.AddCssDependencies("wmi.css");

        this.setIcon("res/scriptfile.svgz");

        this.args = args ? args : { file: null };

        if (this.args.file === null) 
            this.setTitle("Script editor");
        else
            this.setTitle(`Script editor - ${this.args.file}`);

        let waitbox = document.createElement("span");
        waitbox.className = "waitbox";
        waitbox.style.top = "0";
        waitbox.appendChild(document.createElement("div"));
        this.content.appendChild(waitbox);
       
        this.nodes = [];
        this.links = [];
        this.selectedTool = null;
        this.selectedNode = null;
        this.activeNode   = null;
        this.activeSocket = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.x0 = 0;
        this.y0 = 0;
        
        Script_GetColumns(() => {
            this.content.removeChild(waitbox);
            this.InitizialeComponent();

            if (this.args.file)
                this.LoadScript();
        });

        setTimeout(() => {
            if (!this.isMaximized) this.Toogle();
        }, 1);
    }

    InitizialeComponent() {
        this.btnSave = document.createElement("div");
        this.btnSave.style.backgroundImage = "url(res/l_save.svgz)";
        this.btnSave.setAttribute("tip-below", "Save");
        this.toolbox.appendChild(this.btnSave);

        this.btnDebug = document.createElement("div");
        this.btnDebug.style.backgroundImage = "url(res/l_bug.svgz)";
        this.btnDebug.setAttribute("tip-below", "Debug");
        //this.toolbox.appendChild(this.btnDebug);

        this.btnRun = document.createElement("div");
        this.btnRun.style.backgroundImage = "url(res/l_run.svgz)";
        this.btnRun.setAttribute("tip-below", "Run");
        this.toolbox.appendChild(this.btnRun);

        this.lblTitle.style.left = TOOLBAR_GAP + this.toolbox.childNodes.length * 29 + "px";

        this.box = document.createElement("div");
        this.box.className = "script-edit-box";
        this.content.appendChild(this.box);

        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", 400);
        this.svg.setAttribute("height", 300);
        this.svg.tabIndex = 0;
        this.svg.style.outline = "none";
        this.box.appendChild(this.svg);

        this.linksGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.linksGroup.setAttribute("stroke", "black");
        this.linksGroup.setAttribute("stroke-width", 3);
        this.linksGroup.setAttribute("fill", "rgba(0,0,0,0)");
        this.svg.appendChild(this.linksGroup);

        this.line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.line.setAttribute("stroke", "var(--select-color)");
        this.line.setAttribute("stroke-width", 3);
        this.svg.appendChild(this.line);

        this.tools = document.createElement("div");
        this.tools.className = "script-tools-pane";
        this.content.appendChild(this.tools);

        this.txtToolsFilter = document.createElement("input");
        this.txtToolsFilter.type = "search";
        this.txtToolsFilter.placeholder = "Find";
        this.txtToolsFilter.className = "script-tools-filter";
        this.txtToolsFilter.style.width = "calc(100% - 24px)";
        this.tools.appendChild(this.txtToolsFilter);

        this.toolsList = document.createElement("div");
        this.toolsList.className = "script-tools-list";
        this.tools.appendChild(this.toolsList);

        this.ghost = document.createElement("div");
        this.ghost.className = "script-ghost-node";
        this.win.appendChild(this.ghost);

        this.parameters = document.createElement("div");
        this.parameters.className = "script-parameters";
        this.content.appendChild(this.parameters);

        this.selectedName = document.createElement("div");
        this.selectedName.className = "script-selected-name";
        this.parameters.appendChild(this.selectedName);

        this.parametersOptions = document.createElement("div");
        this.parametersOptions.className = "script-parameters-options";
        this.parameters.appendChild(this.parametersOptions);

        const btnDuplicate = document.createElement("input");
        btnDuplicate.type = "button";
        btnDuplicate.style.backgroundImage = "url(res/l_copy.svgz)";
        btnDuplicate.setAttribute("tip", "Duplicate");
        this.parametersOptions.appendChild(btnDuplicate);

        const btnUnlink = document.createElement("input");
        btnUnlink.type = "button";
        btnUnlink.style.backgroundImage = "url(res/l_unkink.svgz)";
        btnUnlink.setAttribute("tip-below", "Unlink");
        this.parametersOptions.appendChild(btnUnlink);

        const btnDelete = document.createElement("input");
        btnDelete.type = "button";
        btnDelete.style.backgroundImage = "url(res/l_delete.svgz)";
        btnDelete.setAttribute("tip-below", "Delete");
        this.parametersOptions.appendChild(btnDelete);

        const btnToogle = document.createElement("input");
        btnToogle.type = "button";
        btnToogle.style.backgroundImage = "url(res/l_toogle.svgz)";
        btnToogle.setAttribute("tip-below", "Toogle");
        this.parametersOptions.appendChild(btnToogle);

        this.parametersList = document.createElement("div");
        this.parametersList.className = "script-parameters-list";
        this.parameters.appendChild(this.parametersList);

        this.svg.onkeyup = event => {
            if (event.keyCode == 46) {//del
                if (!this.selectedNode) return;
                this.Delete(this.selectedNode);
            }
        };

        btnDuplicate.onclick = () => {
            if (!this.selectedNode) return;

            let t = Script_ToolsArray.find(o => o.name === this.selectedNode.name);

            if (!t) return;

            const newNode = new ScriptNode(t, this);
            newNode.MoveTo(this.selectedNode.x + 50, this.selectedNode.y + 50);
            newNode.Attach(this.svg);

            for (let i = 0; i < this.selectedNode.values.length; i++) //copy values
                newNode.values[i] = this.selectedNode.values[i];

            this.nodes.push(newNode);

            this.ShowParameters(newNode);
            this.FitSvgToView();
        };

        btnUnlink.onclick = () => {
            if (!this.selectedNode) return;
            this.selectedNode.UnlinkAllSockets();
        };

        btnDelete.onclick = () => {
            if (!this.selectedNode) return;
            this.Delete(this.selectedNode);
        };

        btnToogle.onclick = () => {
            if (!this.selectedNode) return;

            const list = this.parametersList.querySelector(".columns-list");
            for (let i = 0; i < list.childNodes.length; i++)
                if (list.childNodes[i].tagName.toUpperCase() === "INPUT") {
                    list.childNodes[i].checked = !list.childNodes[i].checked;
                    list.childNodes[i].onchange();
                }
        };
        
        this.btnSave.onclick = () => this.SaveScript();
        this.btnDebug.onclick = () => { };
        this.btnRun.onclick = () => this.RunScript();

        this.ghost.onmouseup = event => this.Ghost_onmouseup(event);

        this.win.addEventListener("mouseleave", () => {
            this.ghost.style.visibility = "hidden";
            if (this.activeSocket != null) {
                this.line.setAttribute("d", "");
                this.activeSocket[1].setAttribute("fill", "rgb(96,96,96)");
                this.activeSocket = null;
            }
        });

        this.win.addEventListener("mousedown", event => {
            this.FitSvgToView();
        });

        this.win.addEventListener("mousemove", event => {
            this.Node_onmousemove(event);
            if (this.selectedTool != null) this.selectedTool.ScriptListTool_onmousemove(event);
            if (this.activeSocket != null) this.selectedNode.Socket_onmousemove(event);

            if (event.buttons == 1) this.FitSvgToView(); //resize svg to fit
        });

        this.win.addEventListener("mouseup", event => {
            this.ghost.style.visibility = "hidden";
            this.Node_onmouseup(event);
            if (this.activeSocket != null) this.selectedNode.Socket_onmouseup(event);
            this.activeSocket = null;
        });

        this.txtToolsFilter.oninput = event => { this.LoadToolsList(this.txtToolsFilter.value); };

        this.LoadToolsList(null);
    }

    LoadScript() {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.status == 403) location.reload(); //authorization

            if (xhr.readyState == 4 && xhr.status == 200) {
                let lines = xhr.responseText.split("\n");
                lines.forEach(line => {
                    line = line.trim();
                    if (line.startsWith("#")) return; //skip comments

                    let split = line.split(String.fromCharCode(127));
                    if (split.length < 3) return;

                    if (split[0] == "n") { //node
                        let tool = Script_ToolsArray.find(o => o.name === split[1]);
                        if (!tool) return;

                        let position = split[2].split(",");
                        let x = parseInt(position[0]);
                        let y = parseInt(position[1]);

                        let values = [];
                        let columns = [];
                        for (let i = 3; i < split.length; i++) {
                            let vSplit = split[i].split(":");
                            if (vSplit[0] == "v")
                                values.push(vSplit[1]);
                            else if (vSplit[0] == "c")
                                columns.push(vSplit[1]);
                        }

                        const newNode = new ScriptNode(tool, this);
                        newNode.MoveTo(x, y);
                        newNode.Attach(this.svg);
                        newNode.values = values;
                        if (columns.length > 0) newNode.selectedColumns = columns;
                        this.nodes.push(newNode);

                    } else if (split[0] == "l") { //link
                        let primaryNode = this.nodes[parseInt(split[1])];
                        let secondaryNode = this.nodes[parseInt(split[3])];
                        let primarySocket = primaryNode.sockets.find(o => o[0]=="o" && o[2].innerHTML == split[2]);
                        let secondarySocket = secondaryNode.sockets.find(o => o[0] == "i" && o[2].innerHTML == split[4]);

                        if (primarySocket && secondarySocket)
                            this.Link(primarySocket, secondarySocket);
                    }

                });

                this.FitSvgToView();

            } else if (xhr.readyState == 4 && xhr.status == 0) //disconnected
                this.ConfirmBox("Server is unavailable.", true);
        };
        xhr.open("GET", "scripts/load&filename=" + this.args.file, true);
        xhr.send();
    }

    SaveScript(callback = null) {
        let payload = "";

        for (let i = 0; i < this.nodes.length; i++) {
            payload += "n" + String.fromCharCode(127) +
                this.nodes[i].name + String.fromCharCode(127) +
                this.nodes[i].x + "," + this.nodes[i].y + String.fromCharCode(127);

            for (let j = 0; j < this.nodes[i].parameters.length; j++) //parameters
                if (this.nodes[i].values[j] === null)
                    payload += "v:" + String.fromCharCode(127);
                else
                    payload += "v:" + this.nodes[i].values[j] + String.fromCharCode(127);

            if (this.nodes[i].selectedColumns != null) //selected columns
                for (let j = 0; j < this.nodes[i].selectedColumns.length; j++)
                    payload += "c:" + this.nodes[i].selectedColumns[j] + String.fromCharCode(127);

            payload += "\n";
        }

        for (let i = 0; i < this.links.length; i++) { //links
            let sourceNode = null;
            let destinationNode = null;

            for (let j = 0; j < this.nodes.length; j++) {

                if (this.links[i][1][5] === this.nodes[j]) //find source
                    sourceNode = this.nodes[j];

                if (this.links[i][2][5] === this.nodes[j]) //find destination
                    destinationNode = this.nodes[j];

                if (sourceNode && destinationNode) break;
            }

            let source, destination;
            for (let j = 0; j < sourceNode.parameters.length; j++) { //find source socket
                if (sourceNode.parameters[j][0] != "o") continue;
                if (sourceNode.parameters[j][1] === this.links[i][1][2].innerHTML) {
                    source = this.nodes.indexOf(sourceNode) + String.fromCharCode(127) + sourceNode.parameters[j][1];
                    break;
                }
            }

            for (let j = 0; j < destinationNode.parameters.length; j++) { //find destination socket
                if (destinationNode.parameters[j][0] != "i") continue;
                if (destinationNode.parameters[j][1] === this.links[i][2][2].innerHTML) {
                    destination = this.nodes.indexOf(destinationNode) + String.fromCharCode(127) + destinationNode.parameters[j][1];
                    break;
                }
            }

            payload += "l" + String.fromCharCode(127) + source + String.fromCharCode(127) + destination + "\n";
        }

        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.status == 403) location.reload(); //authorization

            if (xhr.readyState == 4 && xhr.status == 200) {
                if (callback) callback("ok");

            } else if (xhr.readyState == 4 && xhr.status == 0) { //disconnected
                this.ConfirmBox("Server is unavailable.", true);
                if (callback) callback("failed");
            }
        };

        let now = new Date();
        if (this.args.file === null) this.args.file = now.getFullYear() + "_" + now.getMonth() + "_" + now.getDate() + "_" + now.getHours() + "_" + now.getMinutes() + "_" + now.getTime();

        xhr.open("POST", "scripts/save&filename=" + this.args.file, true);
        xhr.send(payload);
    }

    RunScript() {
        if (this.args.file === null) {
            this.ConfirmBox("Save the script file and try again.", true);
            return;
        }

        this.SaveScript(response => {
            if (response != "ok") {
                this.ConfirmBox("Failed to save script file", true);
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.status == 403) location.reload(); //authorization

                if (xhr.readyState == 4 && xhr.status == 200) {
                    let json = JSON.parse(xhr.responseText);
                    if (json.error) this.ConfirmBox(xhr.responseText, true);

                    if (json.preview) {
                        const p = new ScriptPreview(json.preview);
                        p.setTitle(`Preview - ${this.args.file}`);
                    }

                } else if (xhr.readyState == 4 && xhr.status == 0) //disconnected
                    this.ConfirmBox("Server is unavailable.", true);
            };

            xhr.open("GET", "scripts/run&filename=" + this.args.file, true);
            xhr.send();
        });
    }

    AfterResize() { //override
        this.FitSvgToView();
    }

    Popout() { //override
        super.Popout();

        if (this.popoutWindow) {
            this.popoutWindow.onmousemove = event => {
                this.Node_onmousemove(event);
                this.FitSvgToView();
            }
        }
    }

    FitSvgToView() {
        if (!this.box) return;

        let maxX = this.box.offsetWidth, maxY = this.box.offsetHeight;
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].x + 250 > maxX) maxX = this.nodes[i].x + 250;
            if (this.nodes[i].y + 125 > maxY) maxY = this.nodes[i].y + 125;
        }

        this.svg.setAttribute("width", maxX == this.box.offsetWidth ? Math.max(maxX - 20, 1) : maxX + 50);
        this.svg.setAttribute("height", maxY == this.box.offsetHeight ? Math.max(maxY - 20, 1) : maxY + 50);
    }

    LoadToolsList(filter) {
        this.toolsList.innerHTML = "";

        if (filter === null) filter = "";
        filter = filter.toLowerCase();

        let label = null;
        for (let i = 0; i < Script_ToolsArray.length; i++) {
            if (Script_ToolsArray[i].label) {
                label = document.createElement("div");
                label.innerHTML = Script_ToolsArray[i].label;
                label.style.paddingLeft = "5px";
                label.style.marginTop = "12px";
                label.style.marginRight = "8px";
                label.style.boxSizing = "border-box";
                label.style.backgroundColor = "rgb(80,80,80)";
                label.style.position = "sticky";
                label.style.top = "0";
                continue;
            }

            if (Script_ToolsArray[i].name.toLowerCase().indexOf(filter) == -1) continue;

            if (label) this.toolsList.appendChild(label);
            label = null;

            const newTool = new ScriptListTool(Script_ToolsArray[i].name, Script_ToolsArray[i].color, Script_ToolsArray[i].p, this);
            newTool.Attach(this.toolsList);
        }
    }

    DrawLine(p, s) {
        let x1, y1, x2, y2, x3, y3, x4, y4;

        x1 = p[5].x + p[3];
        y1 = p[5].y + p[4];
        x4 = s[5].x + s[3];
        y4 = s[5].y + s[4];

        if (x1 < x4) {
            let minX = Math.min(x1, x4);
            x2 = minX + (x1-minX) *.7 + (x4-minX) *.3;
            y2 = y1;
            x3 = minX + (x1-minX) *.3 + (x4-minX) *.7;
            y3 = y4;
        } else {
            let d = Math.min(Math.abs(x1-x4), 128);
            x2 = x1 + d*.9;
            x3 = x4 - d*.9;

            let minY = Math.min(y1, y4);
            if (y1 < y4) {
                y2 = y1 + 32 + ((y1-minY) *.3 + (y4-minY) *.7);
                y3 = y4 - 32 - ((y4-minY) *.7 + (y1-minY) *.3);
            } else {
                y2 = y1 - 32 - ((y1-minY) *.3 + (y4-minY) *.7);
                y3 = y4 + 32 + ((y4-minY) *.7 + (y1-minY) *.3);
            }
        }

        return "M " + x1 + " " + y1 + " C " + x2 + " " + y2 + " " + x3 + " " + y3 + " " + x4 + " " + y4;
    }

    ShowParameters(node, force=false) {
        if (this.selectedNode === node && !force) return;

        if (this.selectedNode !== null) {
            this.selectedNode.container.setAttribute("stroke", "rgb(0,0,0)");
            this.selectedNode.container.setAttribute("stroke-width", ".5");
            for (let i = 0; i < this.selectedNode.sockets.length; i++) {
                this.selectedNode.sockets[i][1].setAttribute("stroke", "rgb(0,0,0)");
                this.selectedNode.sockets[i][1].setAttribute("stroke-width", ".5");
            }
        }

        node.container.setAttribute("stroke", "var(--select-color)");
        node.container.setAttribute("stroke-width", "3");
        for (let i = 0; i < node.sockets.length; i++) {
            node.sockets[i][1].setAttribute("stroke", "var(--select-color)");
            node.sockets[i][1].setAttribute("stroke-width", "2");
        }

        this.selectedNode = node;
        this.selectedName.innerHTML = node.name;

        this.svg.removeChild(node.g); //Bring to front
        this.svg.appendChild(node.g); //Bring to front


        this.parametersList.innerHTML = "";

        //input labels
        for (let i = 0; i < this.selectedNode.sockets.length; i++)
            if (this.selectedNode.sockets[i][0] == "i") {
                let match = this.links.find(o => this.selectedNode.sockets[i] === o[2]);

                let newPara = document.createElement("div");
                this.parametersList.appendChild(newPara);

                let label = document.createElement("div");
                label.innerHTML = this.selectedNode.sockets[i][2].innerHTML + ":";
                newPara.appendChild(label);

                if (match) {
                    let value = document.createElement("div");
                    value.innerHTML = match[1][5].name;
                    value.style.textDecoration = "underline";
                    value.style.cursor = "pointer";
                    newPara.appendChild(value);

                    value.onclick = ()=> this.ShowParameters(match[1][5]);
                }
            }

        for (let i = 0; i < node.parameters.length; i++) {
            if (node.parameters[i][0]=="o") continue; //skip ouputs

            let newPara = document.createElement("div");

            let label = document.createElement("div");
            label.innerHTML = node.parameters[i][1] + ":";
            newPara.appendChild(label);

            let value = null;
            if (node.parameters[i][0]=="i") { //input or input list
                //do nothing...
                continue;

            } else if (node.parameters[i][0] == "t") { //text
                value = document.createElement("input");
                value.type = node.parameters[i][1] == "Password" ? "password" : "text";
                value.value = node.values[i] === null ? "" : node.values[i];

            } else if (node.parameters[i][0] == "n") { //number
                value = document.createElement("input");
                value.type = "number";
                value.min = node.parameters[i][3];
                value.max = node.parameters[i][4];
                value.value = node.values[i] === null ? value.min : node.values[i];

            } else if (node.parameters[i][0] == "h") { //checkbox
                value = document.createElement("select");

                let optTrue = document.createElement("option");
                optTrue.innerHTML = "True";
                optTrue.value = "True";
                value.appendChild(optTrue);

                let optFalse = document.createElement("option");
                optFalse.innerHTML = "False";
                optFalse.value = "False";
                value.appendChild(optFalse);

                value.value = node.values[i] === null ? "False" : node.values[i];

            } else if (node.parameters[i][0] == "a") { //column with ALL opt
                let inputSocket = node.sockets.filter(o => o[0] == "i")[0];
                let link = this.links.find(o => o[2] === inputSocket);

                value = document.createElement("select");
                if (link) {
                    const optAll = document.createElement("option");
                    optAll.innerHTML = "[ALL]";
                    optAll.value = "[ALL]";
                    value.appendChild(optAll);

                    let sourceNode = link[1][5];
                    if (sourceNode.columns)
                        for (let i = 0; i < sourceNode.columns.length; i++)
                            if (sourceNode.selectedColumns === null || sourceNode.selectedColumns.includes(sourceNode.columns[i])) {
                                let optNew = document.createElement("option");
                                optNew.innerHTML = sourceNode.columns[i];
                                optNew.value = sourceNode.columns[i];
                                value.appendChild(optNew);
                            }

                    value.value = node.values[i] === null ? "" : node.values[i];
                }

            } else if (node.parameters[i][0] == "c") { //column
                let inputSocket = node.sockets.filter(o => o[0] == "i")[0];
                let link = this.links.find(o => o[2] === inputSocket);

                value = document.createElement("select");
                if (link) {
                    let sourceNode = link[1][5];
                    if (sourceNode.columns)
                        for (let i = 0; i < sourceNode.columns.length; i++)
                            if (sourceNode.selectedColumns === null || sourceNode.selectedColumns.includes(sourceNode.columns[i])) {
                                let optNew = document.createElement("option");
                                optNew.innerHTML = sourceNode.columns[i];
                                optNew.value = sourceNode.columns[i];
                                value.appendChild(optNew);
                            }

                    value.value = node.values[i] === null ? "" : node.values[i];
                }

            } else if (node.parameters[i][0] == "m") { //multiline
                value = document.createElement("input");
                value.type = "button";
                value.value = "Edit";
                value.style.backgroundColor = "var(--control-color)";
                value.style.color = "rgb(32,32,32)";
                value.onclick = () => {
                    if (node.parameters[i][1] == "Query") { //wmi query

                        let lastQuery = "";
                        if (node.values[i]) lastQuery = node.values[i].toLowerCase();

                        let words = lastQuery.split(" ");
                        let className = null;
                        if (Script_WmiClasses.hasOwnProperty("classes"))
                            for (let i = 0; i < words.length; i++)
                                if (words[i].startsWith("win32_")) {
                                    className = words[i];
                                    break;
                                }

                        let select_index = lastQuery.indexOf("select");
                        let from_index = lastQuery.indexOf("from");
                        let lastProperties = lastQuery.substring(select_index + 6, from_index).trim();
                        let lastPropertiesArray = lastProperties.split(",").map(o => o.trim());

                        const dialog = this.DialogBox("640px");
                        if (dialog === null) return;
                        const btnOK = dialog.btnOK;
                        const innerBox = dialog.innerBox;

                        innerBox.style.margin = "16px";
                        innerBox.style.display = "grid";
                        innerBox.style.gridTemplateColumns = "50% 16px auto";
                        innerBox.style.gridTemplateRows = "32px 8px auto 8px 64px";

                        let txtClassFilter = document.createElement("input");
                        txtClassFilter.type = "text";
                        txtClassFilter.placeholder = "Find..";
                        txtClassFilter.style.gridArea = "1 / 1";
                        innerBox.appendChild(txtClassFilter);

                        let lstClasses = document.createElement("div");
                        lstClasses.className = "wmi-classes-list";
                        lstClasses.style.backgroundColor = "rgb(180,180,180)";
                        lstClasses.style.gridArea = "3 / 1";
                        lstClasses.style.overflowY = "scroll";
                        innerBox.appendChild(lstClasses);

                        let lstProperties = document.createElement("div");
                        lstProperties.className = "wmi-properties-list";
                        lstProperties.style.backgroundColor = "rgb(180,180,180)";
                        lstProperties.style.gridArea = "3 / 3";
                        lstProperties.style.overflowY = "scroll";
                        innerBox.appendChild(lstProperties);

                        let txtPreview = document.createElement("textarea");
                        txtPreview.style.resize = "none";
                        txtPreview.style.gridArea = "5 / 1 / span 1 / span 3";
                        innerBox.appendChild(txtPreview);

                        if (!Script_WmiClasses.hasOwnProperty("classes")) {
                            this.ConfirmBox("Failed to load WMI classes.");
                            btnOK.onclick();
                            return;
                        }

                        let selected = null;

                        btnOK.addEventListener("click", () => {
                            value.value = txtPreview.value;
                            value.onchange();
                            value.value = "Edit";
                        });

                        txtClassFilter.oninput = () => {
                            if (!Script_WmiClasses.hasOwnProperty("classes")) return;
                            let filter = txtClassFilter.value.toLowerCase();

                            lstClasses.innerHTML = "";
                            lstProperties.innerHTML = "";

                            for (let i = 0; i < Script_WmiClasses.classes.length; i++) {
                                let matched = false;

                                if (Script_WmiClasses.classes[i].class.toLowerCase().indexOf(filter) > -1)
                                    matched = true;
                                else
                                    for (let j = 0; j < Script_WmiClasses.classes[i].properties.length; j++)
                                        if (Script_WmiClasses.classes[i].properties[j].toLowerCase().indexOf(filter) > -1) {
                                            matched = true;
                                            break;
                                        }

                                let check_list = [];

                                if (matched) {
                                    let newClass = document.createElement("div");
                                    newClass.innerHTML = Script_WmiClasses.classes[i].class;
                                    lstClasses.appendChild(newClass);

                                    newClass.onclick = () => {
                                        if (selected != null) selected.style.backgroundColor = "";

                                        check_list = [];

                                        lstProperties.innerHTML = "";
                                        for (let j = 0; j < Script_WmiClasses.classes[i].properties.length; j++) {
                                            let value = lastProperties == "*" || className == null ||
                                                className.toLowerCase() == Script_WmiClasses.classes[i].class.toLowerCase() &&
                                            lastPropertiesArray.includes(Script_WmiClasses.classes[i].properties[j].toLowerCase());

                                            let divProp = document.createElement("div");
                                            let chkProp = document.createElement("input");
                                            chkProp.type = "checkbox";
                                            chkProp.checked = value;
                                            divProp.appendChild(chkProp);

                                            check_list.push(value);

                                            chkProp.onchange = () => {
                                                check_list[j] = chkProp.checked;
                                                let count = 0;
                                                for (let k = 0; k < check_list.length; k++) if (check_list[k]) count++;

                                                if (count == 0 || count == check_list.length)
                                                    txtPreview.value = "SELECT * FROM " + Script_WmiClasses.classes[i].class;
                                                else {
                                                    let sel = "";
                                                    for (let k = 0; k < check_list.length; k++) if (check_list[k]) sel += (sel.length == 0) ? Script_WmiClasses.classes[i].properties[k] : ", " + Script_WmiClasses.classes[i].properties[k];
                                                    txtPreview.value = "SELECT " + sel + " FROM " + Script_WmiClasses.classes[i].class;
                                                }
                                            };

                                            this.AddCheckBoxLabel(divProp, chkProp, Script_WmiClasses.classes[i].properties[j]);
                                            lstProperties.appendChild(divProp);

                                            selected = newClass;
                                            selected.style.backgroundColor = "var(--select-color)";
                                        }
                                        txtPreview.value = "SELECT * FROM " + Script_WmiClasses.classes[i].class;
                                    };

                                    newClass.ondblclick = () => {
                                        this.txtQuery.value = txtPreview.value;
                                        btnOK.onclick();
                                    };

                                    if (className && className == Script_WmiClasses.classes[i].class.toLowerCase()) {
                                        newClass.onclick();
                                        newClass.scrollIntoView();
                                        className = null;
                                    }
                                }
                            }

                        };
                        txtClassFilter.oninput();

                        txtPreview.value = node.values[i];


                    } else { //script
                        const dialog = this.DialogBox("calc(100% - 24px)");
                        if (dialog === null) return;
                        const btnOK = dialog.btnOK;
                        const innerBox = dialog.innerBox;

                        let txtQuery = document.createElement("textarea");
                        txtQuery.value = node.values[i] === null ? "" : node.values[i];
                        txtQuery.placeholder = "Query";
                        txtQuery.style.width = "calc(100% - 8px)";
                        txtQuery.style.height = "calc(100% - 12px)";
                        txtQuery.style.fontFamily = "monospace";
                        txtQuery.style.resize = "none";
                        txtQuery.style.padding = "24px";
                        txtQuery.style.boxSizing = "border-box";
                        innerBox.appendChild(txtQuery);

                        btnOK.addEventListener("click", () => {
                            value.value = txtQuery.value.trim();
                            value.onchange();
                            value.value = "Edit";
                            node.CalculateColumns();
                            node.PropagateColumns();
                            this.ShowParameters(node, true);
                        });
                    }
                };

            } else {
                value = document.createElement("div");
                value.innerHTML = "";
            }
            value.setAttribute("i", i);
            this.parametersList.appendChild(newPara);
            newPara.appendChild(value);

            value.onchange = () => {
                let index = parseInt(value.getAttribute("i"));
                node.values[index] = value.value;

                //if (node.parameters[i][0] == "c") if (node.columns) node.PropagateColumns(); //propagate on Column change
            };

            if (node.parameters[i][0]!="m" && node.parameters[i][0]!="h") {
                let button = document.createElement("div");
                newPara.appendChild(button);
                button.onclick = () => {
                    if (value.tagName === "div") return;
                    value.value = node.parameters[i].length>2 ? node.parameters[i][2] : "";
                    value.onchange();
                };
            }
        }

        let outputsCount = node.sockets.filter(o => o[0] == "o").length;

        //Total columns
        if (outputsCount > 0) {
            this.parametersList.appendChild(document.createElement("br"));
            
            let hr = document.createElement("hr");
            hr.style.padding = "0";
            this.parametersList.appendChild(hr);

            let lblColumns = document.createElement("div");
            lblColumns.style.backgroundColor = "transparent";
            lblColumns.style.textAlign = "center";
            lblColumns.innerHTML = "Columns (" + (node.columns ? node.columns.length : "0") + ")";
            this.parametersList.appendChild(lblColumns);
        }

        const list = document.createElement("div");
        list.className = "columns-list";
        this.parametersList.appendChild(list);

        //input list
        if (node.columns && node.columns.length > 0 && outputsCount > 0) {
            node.columns.forEach(o => {
                const newItem = document.createElement("input");
                newItem.type = "checkbox";
                newItem.checked = node.selectedColumns === null || node.selectedColumns.includes(o);
                //newItem.innerHTML = o;
                list.appendChild(newItem);

                const label = this.AddCheckBoxLabel(list, newItem, o.length == 0 ? "&nbsp;" : o);
                label.style.margin = "4px 2px";

                newItem.onchange = event => {
                    if (node.selectedColumns === null) {
                        node.selectedColumns = [];
                        for (let i = 0; i < node.columns.length; i++)
                            node.selectedColumns.push(node.columns[i]);
                    }

                    if (newItem.checked)
                        node.selectedColumns.push(label.innerHTML);
                    else
                        node.selectedColumns.splice(node.selectedColumns.indexOf(label.innerHTML), 1);

                    node.PropagateColumns();
                };
            });
        }
    }

    Link(primary, secondary) {
        if (primary[5] === secondary[5]) {
            console.log("A node can't link into it self.");
            return;
        }

        if ((primary[0]!="o" || secondary[0]=="o") && (primary[0]=="o" || secondary[0]!="o")) { //check slot type
            console.log("You can only link output with input.");
            return;
        }

        //type, slot, label, x, y, node
        let p = primary[0]=="o" ? primary : secondary;
        let s = primary[0]=="o" ? secondary : primary;

        this.Unlink(s);

        const newPath = this.container = document.createElementNS("http://www.w3.org/2000/svg", "path");
        newPath.setAttribute("d", this.DrawLine(p, s));
        this.linksGroup.appendChild(newPath);

        this.links.push([newPath, p, s]);

        p[5].Link_onchange();
        s[5].Link_onchange();

        if (s[5] === this.selectedNode) //update parameters
            this.ShowParameters(s[5], true);
    }

    Unlink(socket) {
        let todo = [];
        for (let i = 0; i < this.links.length; i++)
            if (socket === this.links[i][1] || socket === this.links[i][2]) {
                this.linksGroup.removeChild(this.links[i][0]);
                todo.push(this.links[i]);
            }

        for (let i = 0; i < todo.length; i++)
            this.links.splice(this.links.indexOf(todo[i]), 1);

        socket[5].Link_onchange();
    }

    Delete(node) {
        node.UnlinkAllSockets();
        this.nodes.splice(this.nodes.indexOf(node), 1);
        this.svg.removeChild(node.g);
        this.selectedNode = null;
        this.parametersList.innerHTML = "";
    }

    Ghost_onmouseup(event) {
        let pos = this.ghost.style.transform.replace("translate(", "").replace(")", "").split(",");
        let x = parseInt(pos[0].trim().replace("px", "")) - this.box.offsetLeft + this.box.scrollLeft;
        let y = parseInt(pos[1].trim().replace("px", "")) - this.box.offsetTop + this.box.scrollTop - 38;

        if (x < 0) x = 0;
        if (y < 0) y = 0;

        const newNode = new ScriptNode(this.selectedTool, this);
        newNode.MoveTo(x, y);
        newNode.Attach(this.svg);

        this.nodes.push(newNode);

        this.ShowParameters(newNode);
        this.FitSvgToView();
    }

    Node_onmousedown(event, node) {
        if (event.buttons != 1) return;
        this.activeNode = node;

        this.offsetX = this.activeNode.x;
        this.offsetY = this.activeNode.y;
        this.x0 = event.clientX;
        this.y0 = event.clientY;

        this.ShowParameters(node);
    }

    Node_onmousemove(event) {
        if (this.activeNode === null) return;
        if (event.buttons != 1) return;

        let x = this.offsetX - (this.x0 - event.clientX);
        let y = this.offsetY - (this.y0 - event.clientY);

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        this.activeNode.MoveTo(x, y);

        for (let i = 0; i < this.links.length; i++)
            if (this.activeNode === this.links[i][1][5] || this.activeNode === this.links[i][2][5])
                this.links[i][0].setAttribute("d", this.DrawLine(this.links[i][1], this.links[i][2]));
    }

    Node_onmouseup(event) {
        this.activeNode = null;
    }
}

class ScriptListTool {
    constructor(name, color, parameters, editor) {
        this.name    = name;
        this.color   = color;
        this.columns = [];
        this.p       = parameters;
        this.editor  = editor;

        this.element = document.createElement("div");
        //this.element.innerHTML = name;
        this.element.className = "script-edit-box-item";

        let dot = document.createElement("div");
        dot.style.display = "inline-block";
        dot.style.width = dot.style.height = "11px";
        dot.style.marginRight = "8px";
        dot.style.border = "rgb(64,64,64) solid 1px";
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = color;
        this.element.appendChild(dot);

        let label = document.createElement("div");
        label.style.display = "inline-block";
        label.innerHTML = name;
        this.element.appendChild(label);

        this.element.onmousedown = event => this.ScriptListTool_onmousedown(event);
        this.element.onmousemove = event => this.ScriptListTool_onmousemove(event);
        this.element.onmouseup = event => this.ScriptListTool_onmouseup(event);
    }

    Attach(container) {
        container.appendChild(this.element);
    }

    ScriptListTool_onmousedown(event) {
        if (event.buttons != 1) return;
        this.editor.ghost.style.visibility = "visible";
        this.ScriptListTool_onmousemove(event);
        this.editor.selectedTool = this;
        this.editor.ghost.innerHTML = this.name;
    }

    ScriptListTool_onmousemove(event) {
        if (event.buttons == 1 && this.editor.ghost.style.visibility == "visible") { //left click
            let a = Math.max((event.pageX - this.editor.win.offsetLeft - 100) / 100, 0);
            let x = Math.max(event.pageX - this.editor.win.offsetLeft - 100, 230);
            let y = event.pageY - this.editor.win.offsetTop - this.editor.content.offsetTop;

            this.editor.ghost.style.backgroundColor = "rgba(64,64,64," + Math.min(a, .75) + ")";
            this.editor.ghost.style.opacity = a;
            this.editor.ghost.style.transform = "translate(" + x + "px," + y + "px)";
            this.editor.ghost.style.backdropFilter = "blur(" + Math.min(a*4, 4) + "px)";

            event.stopPropagation();
        }
    }

    ScriptListTool_onmouseup(event) {
        this.editor.ghost.style.visibility = "hidden";
    }
}

class ScriptNode {
    constructor(tool, editor) {
        this.x = 0;
        this.y = 0;
        this.editor = editor;
        this.name = tool.name;

        this.columns         = null;
        this.selectedColumns = null;
        this.parameters      = [];
        this.values          = [];
        this.sockets         = [];

        this.g = document.createElementNS("http://www.w3.org/2000/svg", "g");

        this.container = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this.container.setAttribute("width", 200);
        this.container.setAttribute("height", 75);
        this.container.setAttribute("rx", 4);
        this.container.setAttribute("ry", 4);
        this.container.setAttribute("fill", "rgb(64,64,64)");
        this.container.setAttribute("stroke", "rgb(0,0,0)");
        this.container.setAttribute("stroke-width", ".5");
        this.g.appendChild(this.container);

        this.titleBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this.titleBox.setAttribute("x", 2);
        this.titleBox.setAttribute("y", 2);
        this.titleBox.setAttribute("width", 196);
        this.titleBox.setAttribute("height", 20);
        this.titleBox.setAttribute("rx", 4);
        this.titleBox.setAttribute("ry", 4);
        this.titleBox.setAttribute("fill", tool.color);
        this.titleBox.setAttribute("opacity", tool.color == "rgb(224,224,224)" ? ".3" : ".4");
        this.g.appendChild(this.titleBox);

        this.titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        this.titleText.innerHTML = tool.name;
        this.titleText.setAttribute("font-weight", "600");
        this.titleText.setAttribute("dominant-baseline", "middle");
        this.titleText.setAttribute("text-anchor", "middle");
        this.titleText.setAttribute("x", 100);
        this.titleText.setAttribute("y", 14);
        this.titleText.setAttribute("fill", "rgb(224,224,224)");
        this.g.appendChild(this.titleText);

        let top = 38;

        for (let i = 0; i < tool.p.length; i++) {
            this.parameters.push(tool.p[i]); //copy
            this.values.push(tool.p[i].length > 2 ? tool.p[i][2] : null);

            if (tool.p[i][0] == "i" || tool.p[i][0] == "o") { //input or output
                let socket = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                socket.id = "dot";
                socket.setAttribute("r", 8);
                socket.setAttribute("cx", tool.p[i][0]=="o" ? 200 : 0);
                socket.setAttribute("cy", top);
                socket.setAttribute("fill", "rgb(96,96,96)");
                socket.setAttribute("stroke", "rgb(0,0,0)");
                socket.setAttribute("stroke-width", ".5");
                this.g.appendChild(socket);

                let label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.innerHTML = tool.p[i][1];
                label.setAttribute("dominant-baseline", "middle");
                label.setAttribute("text-anchor", tool.p[i][0]=="o" ? "end" : "start");
                label.setAttribute("x", tool.p[i][0]=="o" ? 188 : 12);
                label.setAttribute("y", top+1);
                label.setAttribute("fill", "rgb(224,224,224)");
                this.g.appendChild(label);

                //type, socket, label, x, y, node
                this.sockets.push([tool.p[i][0], socket, label, tool.p[i][0]=="o" ? 200 : 0, top, this]);
                top += 24;

                socket.onmousedown = event => this.Socket_onmousedown(event);
                socket.onmousemove = event => this.Socket_onmousemove(event);
                socket.onmouseup = event => this.Socket_onmouseup(event);
            }
        }

        if (this.sockets.length === 1 && this.sockets[0][0] === "i") {
            this.container.setAttribute("width", 84);
            this.titleBox.setAttribute("width", 80);
            this.titleText.setAttribute("x", 44);

            this.sockets[0][1].setAttribute("cy", 46);
            this.sockets[0][2].setAttribute("y", 47);
            this.sockets[0][4] = 46;
        }

        this.container.setAttribute("height", Math.max(top-10, 75));

        this.g.onmousedown = event => editor.Node_onmousedown(event, this);
        this.g.onmousemove = event => editor.Node_onmousemove(event);
        this.g.onmouseup = event => editor.Node_onmouseup(event);

        //this.PropagateColumns();
        this.Link_onchange();
    }

    Attach(container) {
        container.appendChild(this.g);
    }

    MoveTo(x, y) {
        this.x = x;
        this.y = y;
        this.g.setAttribute("transform", "translate(" + x + "," + y + ")");
    }

    UnlinkAllSockets() {
        for (let i = 0; i < this.sockets.length; i++)
            this.editor.Unlink(this.sockets[i]);
    }

    PropagateColumns(queue=null, count=0) {
        if (count > 200) {
            console.log("Closed loop or huge diagram error.");
            return [];
        }

        let target  = queue === null ? this : queue;
        let inputs  = target.sockets.filter(o => o[0]=="i");
        let outputs = target.sockets.filter(o => o[0]=="o");

        let columnsCollection = [];               //values for each input
        for (let i = 0; i < inputs.length; i++) { //find source
            let find = this.editor.links.find(o => o[2] === inputs[i]);
            if (find) {
                let sourceNode = find[1][5];

                let r = []; //filter non-selected columns
                for (let i = 0; i < sourceNode.columns.length; i++)
                    if (sourceNode.selectedColumns === null || sourceNode.selectedColumns.includes(sourceNode.columns[i]))
                        r.push(sourceNode.columns[i]);

                columnsCollection.push(r);

            } else {
                columnsCollection.push(null)
            }
        }

        let result = target.CalculateColumns(columnsCollection);

        for (let i = 0; i < outputs.length; i++)  //propagate forward
            this.editor.links.forEach(o => { if (o[1] === outputs[i]) this.PropagateColumns(o[2][5], ++count); });

        return result;
    }

    CalculateColumns(collection) {
        let columns = [];

        switch (this.name) {
            case "Pro-test users":       columns = Script_PtUserColumns; break;
            case "Pro-test equipment":   columns = Script_PtEquipColumns; break;
            case "Domain users":        columns = Script_AdUserColumns; break;
            case "Domain workstations": columns = Script_AdWorkstationColumns; break;
            case "Domain groups":       columns = Script_AdGroupsColumns; break;
            case "IPv4 subnet":         columns = ["IP address"]; break;
            case "Single value":        columns = ["Value"]; break;

            case "WMI query": {
                let query = this.values[2] ? this.values[2].toLowerCase() : "";
                let select_idx = query.indexOf("select");
                let from_idx   = query.indexOf("from");

                if (select_idx < 0 || from_idx < 0) { //invalid query
                    columns = ["Host"];
                    break;
                }

                let words = query.split(" ");
                let className = null;
                for (let i = 0; i < words.length; i++)
                    if (words[i].startsWith("win32_")) {
                        className = words[i].toLowerCase();
                        break;
                    }

                columns = ["Host"];
                let properties = this.values[2].substring(select_idx + 6, from_idx).split(",").map(o => o.trim());

                if (properties.length == 1 && properties[0] == "*" && className && Script_WmiClasses.hasOwnProperty("classes")) {
                    let match = Script_WmiClasses.classes.find(o => o.class.toLowerCase() == className);
                    if (match) {
                        for (let i = 0; i < match.properties.length; i++)
                            columns.push(match.properties[i]);
                        break;
                    }
                }

                for (let i = 0; i < properties.length; i++)
                    if (properties[i] != "*")
                        columns.push(properties[i]);

                break;
            }

            case "PS exec":      columns = ["Host", "Timestamp", "Input", "Output"]; break;
            case "Secure shell": columns = ["Host", "Timestamp", "Input", "Output"]; break;

            case "NetBIOS request":    columns = ["IP Address", "NetBIOS name"]; break;
            case "DNS lookup":         columns = ["Hostname", "IP Address"]; break;
            case "Reverse DNS lookup": columns = ["IP address", "Hostname"]; break;
            case "ICMP ping":          columns = ["Host", "Status", "Roundtrip time"]; break;
            case "ARP ping":           columns = ["Host", "Response"]; break;
            case "Trace route":        columns = ["Host", "Route"]; break;
            case "Port scan":          columns = ["Host", "Ports"]; break;
            case "Locate IP":          columns = ["Host", "Code", "Country", "Region", "City", "Latitude", "Longitude", "Is proxy"]; break;
            case "MAC lookup":         columns = ["MAC address", "Manufacturer"]; break;

            case "Sum":     columns = ["Sum"]; break;
            case "Maximum": columns = ["Maximum"]; break;
            case "Minimum": columns = ["Minimum"]; break;
            case "Mean":    columns = ["Mean"]; break;
            case "Median":  columns = ["Median"]; break;
            case "Mode":    columns = ["Mode"]; break;
            case "Range":   columns = ["Range"]; break;

            case "Merge columns":
                collection.forEach(o => { if (o != null) columns = columns.concat(o); });
                break;

            case "Merge rows":
                columns = collection[0] === null ? [] : collection[0];
                break;

            case "Wake on LAN": columns = []; break;
            case "Turn off PC": columns = []; break;
            case "Restart PC":  columns = []; break;
            case "Log off PC":  columns = []; break;

            default: columns = collection[0] === null ? [] : collection[0];
        }

        //this.titleText.innerHTML = this.name + " (" + columns.length + ")";
        this.columns = columns;
        return columns;
    }

    Link_onchange() {
        this.PropagateColumns();

        for (let i = 0; i < this.parameters.length; i++) 
            if (this.parameters[i][0] === "a" && !this.values[i]) {
                this.values[i] = "[ALL]";

            } else if (this.parameters[i][0] === "c" && !this.values[i]) {

                if (this.columns.length === 1) {
                    this.values[i] = this.columns[0];
                    continue;
                }

                let prio = ["ip address", "ip", "hostname", "host", "username"];

                for (let j = 0; j < this.columns.length; j++) {
                    for (let k = 0; k < prio.length; k++)
                        if (this.columns[j].toLowerCase() === prio[k]) {
                            this.values[i] = this.columns[j];
                            break;
                        }

                    if (!this.values[i]) break;
                }
            }
    }

    Socket_onmousedown(event) {
        this.editor.ShowParameters(this);

        this.editor.activeSocket = this.sockets.find(o => o[1] === event.target);

        this.editor.activeSocket[1].setAttribute("fill", "var(--select-color)");

        this.editor.offsetX = this.x + this.editor.activeSocket[3];
        this.editor.offsetY = this.y + this.editor.activeSocket[4];
        this.editor.x0 = event.clientX;
        this.editor.y0 = event.clientY;

        event.stopPropagation();
    }

    Socket_onmousemove(event) {
        if (event.buttons != 1) return;
        if (!this.editor.activeSocket) return;

        let x1 = this.x + this.editor.activeSocket[3];
        let y1 = this.y + this.editor.activeSocket[4];
        let x2 = this.editor.offsetX - (this.editor.x0 - event.clientX);
        let y2 = this.editor.offsetY - (this.editor.y0 - event.clientY);

        this.editor.line.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
    }

    Socket_onmouseup(event) {
        if (!this.editor.activeSocket) return;

        let secondary = null;
        if (event.target.tagName == "circle" && event.target.id == "dot")
            secondary = this.sockets.find(o => o[1] === event.target); //find second socket

        if (secondary === null) {//on miss-click, find closest node and link to first socket
            let x = this.editor.offsetX - (this.editor.x0 - event.clientX);
            let y = this.editor.offsetY - (this.editor.y0 - event.clientY);

            let node = this.editor.nodes.find(o => o.x<x && o.x+200>x && o.y<y && o.y+75>y);
            if (node)
                secondary = this.editor.activeSocket[0]=="o" ? node.sockets.find(o => o[0]=="i") : node.sockets.find(o => o[0]=="o");
        }

        if (secondary) this.editor.Link(this.editor.activeSocket, secondary);

        this.editor.line.setAttribute("d", "");
        this.editor.activeSocket[1].setAttribute("fill", "rgb(96,96,96)");
        this.editor.activeSocket = null;
    }
}