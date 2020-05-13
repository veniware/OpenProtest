class List extends Window {
    constructor(args) {
        super([64, 64, 64]);

        this.args = args ? args : { find:"", filter:"", sort:"" };

        this.AddCssDependencies("list.css");

        //this.columns = ["NAME", "TYPE", "HOSTNAME", "IP", "MANUFACTURER", "MODEL", "OWNER", "LOCATION"];

        this.titlebar = document.createElement("div");
        this.titlebar.className = "list-titlebar";
        this.content.appendChild(this.titlebar);

        this.columnsOptions = document.createElement("div");
        this.columnsOptions.className = "list-titlebar-options";
        this.titlebar.appendChild(this.columnsOptions);

        this.list = document.createElement("div");
        this.list.className = "list-view";
        this.content.appendChild(this.list);

        this.toolbox.className += " toolbox-with-submenu";

        this.btnFilter = document.createElement("div");
        this.btnFilter.style.backgroundImage = "url(res/l_filter.svgz)";
        this.btnFilter.tabIndex = 0;
        this.toolbox.appendChild(this.btnFilter);

        this.filterSubmenu = document.createElement("div");
        this.filterSubmenu.className = "tool-submenu";
        this.btnFilter.appendChild(this.filterSubmenu);

        this.btnSort = document.createElement("div");
        this.btnSort.style.backgroundImage = "url(res/l_sort.svgz)";
        this.btnSort.tabIndex = 0;
        this.toolbox.appendChild(this.btnSort);

        this.sortSubmenu = document.createElement("div");
        this.sortSubmenu.className = "tool-submenu";
        this.btnSort.appendChild(this.sortSubmenu);

        this.btnFind = document.createElement("div");
        this.btnFind.style.backgroundImage = "url(res/l_search.svgz)";
        this.btnFind.tabIndex = 0;
        this.btnFind.style.cursor = "text";
        this.btnFind.style.backgroundPosition = "1px 50%";
        this.btnFind.style.overflow = "hidden";
        this.toolbox.appendChild(this.btnFind);

        this.txtFind = document.createElement("input");
        this.txtFind.type = "text";        
        this.txtFind.style.color = "rgb(224,224,224)";
        this.txtFind.style.margin = "2px 0px";
        this.txtFind.style.padding = "0";
        this.txtFind.style.paddingLeft = "26px";
        this.txtFind.style.width = "calc(100% - 26px)";
        this.txtFind.style.background = "none";
        this.txtFind.style.animation = "none";
        this.btnFind.appendChild(this.txtFind);

        this.lblTitle.style.left = TOOLBAR_GAP + this.toolbox.childNodes.length * 29 + "px";

        this.lblTotal = document.createElement("div");
        this.lblTotal.className = "list-total";
        this.lblTotal.innerHTML = "0 / 0";
        this.content.appendChild(this.lblTotal);
        this.lblTotal.onmousedown = event => {
            this.BringToFront();
            event.stopPropagation();
        };

        this.view = [];
        this.db = null;

        this.btnFilter.onfocus = () => {
            if (this.popoutWindow) {
                this.filterSubmenu.style.maxHeight = this.content.clientHeight - 64 + "px";
            } else {
                this.filterSubmenu.style.maxHeight = container.clientHeight - this.win.offsetTop - 64 + "px";
            }
        };

        this.btnFilter.ondblclick = () => {
            this.args.filter = "";
            this.btnFilter.style.borderBottom = "none";
            for (let j = 0; j < this.filterSubmenu.childNodes.length; j++)
                this.filterSubmenu.childNodes[j].style.boxShadow = "none";

            this.RefreshList();
        };

        this.btnSort.onfocus = () => {
            if (this.popoutWindow) {
                this.sortSubmenu.style.maxHeight = this.content.clientHeight - 64 + "px";
            } else {
                this.sortSubmenu.style.maxHeight = container.clientHeight - this.win.offsetTop - 64 + "px";
            }
        };

        this.btnSort.ondblclick = () => {
            this.args.sort = "";
            this.btnSort.style.borderBottom = "none";
            for (let j = 0; j < this.sortSubmenu.childNodes.length; j++)
                this.sortSubmenu.childNodes[j].style.boxShadow = "none";

            this.RefreshList();
        };

        this.txtFind.onblur = () => {
            if (this.txtFind.value.length > 0) return;
            this.btnFind.style.width = "";
            this.btnFind.style.backgroundColor = "";
            this.txtFind.onchange();
        };

        this.btnFind.onfocus =
        this.txtFind.onfocus = () => {
            this.txtFind.focus();
            this.btnFind.style.width = "180px";
            this.btnFind.style.backgroundColor = "rgb(96,96,96)";
        };

        this.btnFind.ondblclick = () => {
            this.txtFind.value = "";
            this.btnFind.style.borderBottom = "none";
        };
        this.txtFind.onkeyup = event => { if (event.key === "Escape") this.txtFind.value = ""; };

        this.txtFind.onchange = () => {
            this.RefreshList();
            this.btnFind.style.borderBottom = this.txtFind.value.length === 0 ? "none" : "var(--theme-color) solid 2px";
            this.args.find = this.txtFind.value;
        };

        this.columnsOptions.onclick = () => this.CustomizeColumns();
        this.list.onscroll = () => this.UpdateViewport();

        if (args.find.length > 0) {
            this.txtFind.value = args.find;
            this.btnFind.style.borderBottom = this.txtFind.value.length === 0 ? "none" : "var(--theme-color) solid 2px";
        }
    }

    OnUiReady(count=0) {
        if (this.list.clientHeight === 0 && count < 500)
            setTimeout(() => { this.OnUiReady() }, 25);
        else
            this.UpdateViewport(++count);
    }

    UpdateTitlebar() {
        let titles = [];

        if (this.titlebar.length === 1 || true)
            for (let i = 0; i < 4; i++) {
                let lblTitle = document.createElement("div");
                lblTitle.className = "list-title-" + i;
                this.titlebar.appendChild(lblTitle);
                titles.push(lblTitle);
            }        

        this.sortSubmenu.innerHTML = "";

        for (let i = 0; i < titles.length; i++)
            titles[i].innerHTML = `${this.columns[i*2]}/${this.columns[i*2+1]}`.toLowerCase();

        for (let i = 0; i < this.columns.length; i++) {
            let newItem = document.createElement("div");
            newItem.innerHTML = this.columns[i].toLowerCase();
            this.sortSubmenu.appendChild(newItem);

            if (this.args.sort == this.columns[i].toLowerCase()) {
                this.btnSort.style.borderBottom = "var(--theme-color) solid 2px";
                newItem.style.boxShadow = "rgb(64,64,64) 0 0 0 2px inset";
            }

            newItem.onclick = () => {
                for (let j = 0; j < this.sortSubmenu.childNodes.length; j++)
                    this.sortSubmenu.childNodes[j].style.boxShadow = "none";

                this.btnSort.style.borderBottom = "var(--theme-color) solid 2px";
                newItem.style.boxShadow = "rgb(64,64,64) 0 0 0 2px inset";

                this.args.sort = this.columns[i].toLowerCase();

                this.RefreshList();
            };
        }
    }

    UpdateViewport() { //override

    }

    CustomizeColumns() {
        const dialog = this.DialogBox("240px");
        if (dialog === null) return;
        const btnOK = dialog.btnOK;
        const innerBox = dialog.innerBox;

        btnOK.addEventListener("click", event => {
            //todo:
            this.RefreshList();
        });
    }

    RefreshList() { //override
        this.view = [];
        this.list.innerHTML = "";

        let keywords = this.txtFind.value.length > 0 ? this.txtFind.value.split(" ") : [];

        for (let i = 0; i < this.db.length; i++) {

            if (this.hasTypes) {
                let type = (this.db[i].hasOwnProperty("TYPE")) ? this.db[i]["TYPE"][0].toLowerCase() : "";
                if (type && type.length > 0 && !this.typeslist.includes(type))
                    this.typeslist.push(type);

                if (this.args.filter.length > 0)
                    if (this.args.filter != type)
                        continue;
            }

            if (keywords.length > 0) { //find
                let match = true;

                for (let j = 0; j < keywords.length; j++) {
                    let flag = false;
                    for (let k in this.db[i]) {
                        //if (k.startsWith(".") && k != ".FILENAME") continue;
                        if (this.db[i][k][0].toLowerCase().indexOf(keywords[j]) > -1)
                            flag = true;
                    }
                    if (!flag) {
                        match = false;
                        continue;
                    }
                }

                if (!match) continue;
            }

            this.view.push(this.db[i]);
        }

        if (this.args.sort.length > 0) { //sort
            let param = this.args.sort.toUpperCase();
            this.view.sort((a, b) => {
                if (a[param] == undefined && b[param] == undefined) return 0;
                if (a[param] == undefined) return 1;
                if (b[param] == undefined) return -1;
                if (a[param][0] < b[param][0]) return -1;
                if (a[param][0] > b[param][0]) return 1;
                return 0;
            });
        }

        this.list.style.display = "none";

        for (let i = 0; i < this.view.length; i++) { //display
            let element = document.createElement("div");
            element.className = "lst-obj-ele";
            this.list.appendChild(element);
        }

        this.list.style.display = "block";

        this.UpdateViewport();
    }

    InflateElement(element, entry, c_type) { } //overridable

    AfterResize() { //override
        this.UpdateViewport();
    }

    UpdateViewport() { //override
        for (let i = 0; i < this.list.childNodes.length; i++)
            if (this.list.childNodes[i].offsetTop - this.list.scrollTop < -40 ||
                this.list.childNodes[i].offsetTop - this.list.scrollTop > this.list.clientHeight) {
                this.list.childNodes[i].innerHTML = "";
            } else {
                if (this.list.childNodes[i].childNodes.length > 0) continue;
                let type = (this.view[i].hasOwnProperty("TYPE")) ? this.view[i]["TYPE"][0].toLowerCase() : "";
                this.InflateElement(this.list.childNodes[i], this.view[i], type);
            }

        this.lblTotal.innerHTML = "Total:&nbsp;" + (this.db.length === this.view.length ? this.db.length : this.view.length + " / " + this.db.length);
    }

}