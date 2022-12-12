(async function () {
  const acceptedAssignmentTypes = ['assignments'];
  function addDescriptions() {
    // get all course divs in each day section

    document
      .querySelectorAll('.planner-day > div > .planner-grouping')
      .forEach(async function (courseDiv) {
        // loop through assignments in the courseDiv
        const assignments = courseDiv.querySelector('ol')?.children;
        for (let assignmentLi of assignments) {
          // check if assignmentLi already has been edited
          if (assignmentLi.classList.contains('.arc-boost-edit')) continue;

          const assignmentDiv = assignmentLi.querySelector('.planner-item');
          if (assignmentDiv == null) continue;

          // get assignment url
          const url = assignmentDiv?.querySelector('a')?.href;
          if (url == null) continue;

          // trim first https://school.instructure.com part of url, and split by /
          let urlParts = url.split('/').slice(3);

          let appendElement;
          let assignmentType = urlParts.at(-2);

          // make sure the assignment type is accepted
          if (!acceptedAssignmentTypes.includes(assignmentType)) continue;

          // from here on the assignment WILL be edited, no more continue statements
          // add .arc-boost-edit class to prevent double edits
          assignmentLi.classList.add('.arc-boost-edit');

          switch (assignmentType) {
            case 'assignments':
              appendElement = await renderAssignment(urlParts);
          }

          // append appendElement to correct part of assignmentDiv
          assignmentDiv
            .querySelector('.PlannerItem-styles__layout')
            .appendChild(appendElement);
        }
      });
  }

  function getHost() {
    // get the main part of url using location object
    return `${window.location.protocol}//${window.location.host}`;
  }
  async function getApiJson(urlParts, params = {}) {
    let paramString = '';
    for (let key in params) {
      paramString += `${key}=${params[key]}&`;
    }
    const response = await fetch(
      `${getHost()}/api/v1/${urlParts.join('/')}?${paramString}`
    );
    return await response.json();
  }
  async function renderAssignment(urlParts) {
    const { description } = await getApiJson(urlParts);
    let ret = document.createElement('div');
    ret.innerHTML = description;
    ret.classList.add('arc-boost-description');
    return ret;
  }

  const observer = new MutationObserver(() => {
    addDescriptions();
  });
  observer.observe(document.body.parentElement, {
    subtree: true,
    childList: true,
  });

  // detect cmd/ctrl + K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      createCommandBar();
    }
  });

  async function getCourseData() {
    // go through all pages of courses with page parameter
    let page = 1;
    let courseData = [];
    while (true) {
      let data = await getApiJson(['courses'], {
        page,
        enrollment_state: 'active',
      });
      if (data.length == 0) break;
      courseData.push(...data);
      page++;
    }
    return courseData;
  }
  const courseData = await getCourseData();
  let searchableCommands = courseData
    .map((course) => course.name)
    .filter((name) => name != undefined);
  console.log(searchableCommands);
  let commandIdDict = courseData.reduce((acc, course) => {
    acc[course.name] = course.id;
    return acc;
  }, {});
  function createCommandBar() {
    const commandBarWrapper = document.createElement('div');
    commandBarWrapper.classList.add('arc-boost-command-bar-wrapper');

    const commandBar = document.createElement('div');
    commandBar.classList.add('arc-boost-command-bar');
    commandBar.innerHTML = `
    <input type="text" placeholder="Command" />
    <ul></ul>
  `;
    const input = commandBar.querySelector('input');
    const commandList = commandBar.querySelector('ul');

    let selectedIndex = 0;

    function setSelectedIndex(newSelectedIndex) {
      selectedIndex = newSelectedIndex;
      if (selectedIndex < 0) selectedIndex = 0;
      if (selectedIndex >= commandList.children.length)
        selectedIndex = commandList.children.length - 1;
      const children = commandList.children;
      for (let i = 0; i < children.length; i++) {
        if (i === selectedIndex) {
          children[i].classList.add('selected');
          // scroll to selected element
          children[i].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        } else {
          children[i].classList.remove('selected');
        }
      }
    }
    let search = '';
    function updateSearch(newSearch) {
      search = newSearch;
      commandList.innerHTML = '';
      for (let command of searchableCommands) {
        if (command.toLowerCase().includes(search.toLowerCase())) {
          const li = document.createElement('li');
          li.innerHTML = command;
          commandList.appendChild(li);
        }
      }
      setSelectedIndex(0);
    }
    function close() {
      document.querySelector('.arc-boost-command-bar-wrapper').remove();
    }

    input.addEventListener('input', (e) => {
      updateSearch(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (e.key === 'ArrowDown') {
          setSelectedIndex(selectedIndex + 1);
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex(selectedIndex - 1);
        }
      } else if (e.key === 'Enter') {
        const command = commandList.children[selectedIndex].innerHTML;
        const courseId = commandIdDict[command];
        window.location = `${getHost()}/courses/${courseId}`;
      } else if (e.key === 'Escape') {
        close();
      }
    });
    commandBarWrapper.addEventListener('click', (e) => {
      if (e.target === commandBarWrapper) {
        close();
      }
    });
    commandList.addEventListener('click', (e) => {
      const command = e.target.innerHTML;
      const courseId = commandIdDict[command];
      window.location = `${getHost()}/courses/${courseId}`;
    });

    commandBarWrapper.appendChild(commandBar);
    document.body.appendChild(commandBarWrapper);
    input.focus();
    updateSearch('');
  }
})();
