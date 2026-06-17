// router.js — hash-based navigation for admin panel

function navigate(hash) {
  location.hash = hash;
}

function route() {
  var hash = location.hash.replace('#', '');
  var parts = hash.split('/');
  var section = parts[0];
  var id = parts[1];

  updateSidebarActive(section, id);

  switch (section) {
    case 'cities':
      id ? showCityPanel(id) : showAllCitiesPanel();
      break;
    case 'landmarks':
      id ? showLandmarkPanel(id) : showAllLandmarksPanel();
      break;
    case 'tours':
      if (id) showTourPanel(id);
      break;
    case 'pages':
      showPagesPanel();
      break;
    case 'sections':
      showSectionsPanel();
      break;
    case 'tags':
      showTagsPanel();
      break;
    case 'reestr':
      showReestrPanel();
      break;
    case 'authors':
      showAuthorsPanel();
      break;
    case 'programs':
      showProgramsPanel();
      break;
    case 'shows':
      showShowsPanel();
      break;
    default:
      showLogsPanel();
      break;
  }
}

function updateSidebarActive(section, id) {
  document.querySelectorAll('#city-list .city-item').forEach(function(el) {
    el.classList.remove('selected');
  });
  if (section === 'cities' && id) {
    var el = document.querySelector('.city-item[data-id="' + id + '"]');
    if (el) el.classList.add('selected');
  }
}

function toggleDrawer() {
  document.getElementById('left').classList.toggle('active');
}

function initRouter() {
  window.addEventListener('hashchange', route);
  route();
}
