/* iPedia Play Store — κατάλογος εφαρμογών.
   Για να προσθέσεις νέα εφαρμογή:
   1. Ανέβασε το landing page στον δικό του φάκελο κάτω από playstore/.
   2. Αντέγραψε ένα αντικείμενο μέσα στο APPS και άλλαξε slug, title,
      category, description, image, landing, tags.
   3. Δήλωσε το playUrl (επίσημος σύνδεσμος καταχώρισης Google Play).
      Οι κάρτες με playUrl εμφανίζουν δύο κουμπιά, με το ίδιο πρότυπο.
   4. Κάνε commit και push από το GitHub Desktop. Δεν αλλάζεις το index.html.
*/
(function(){
  'use strict';
  const APPS = [
    {
      slug: 'electromagnetism-gymnasium',
      title: 'Ηλεκτρομαγνητισμός Γ΄ Γυμνασίου',
      category: 'Διαδραστικό βιβλίο Φυσικής · Android',
      description: 'Μαγνήτες, μαγνητικά πεδία, ηλεκτρομαγνητισμός, κινητήρας και γεννήτρια. Παρουσίαση με δύο εργαστήρια που μπορείς να δοκιμάσεις στον browser.',
      image: 'playstore/electromagnetism-gymnasium/assets/electromagnetism-icon.png',
      landing: 'playstore/electromagnetism-gymnasium/',
      playUrl: 'https://play.google.com/store/apps/details?id=com.ipedia.emappdemo',
      tags: ['Μαγνητικό πεδίο', '3D πείραμα Laplace', 'Τεστ & XP']
    }
    // ΕΠΟΜΕΝΗ ΕΦΑΡΜΟΓΗ: πρόσθεσε κόμμα μετά το προηγούμενο } και νέο {...} εδώ.
  ];

  function node(tag, className, text){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(text != null) el.textContent = text;
    return el;
  }
  function render(){
    const grid = document.getElementById('playAppsGrid');
    if(!grid) return;
    const fragment = document.createDocumentFragment();
    APPS.forEach((app) => {
      if(!app || !app.title || !app.landing) return;
      const card = node('article', 'card playAppCard');
      const info = node('div', 'playAppInfo');
      const icon = node('img', 'playAppIcon');
      icon.src = app.image;
      icon.alt = 'Εικονίδιο εφαρμογής: ' + app.title;
      icon.width = 94;
      icon.height = 94;
      icon.loading = 'lazy';
      icon.decoding = 'async';
      info.appendChild(icon);

      const copy = node('div', 'playAppCopy');
      copy.appendChild(node('div', 'playAppType', app.category));
      const title = node('h4', '', app.title);
      title.id = 'play-app-' + app.slug;
      card.setAttribute('aria-labelledby', title.id);
      copy.appendChild(title);
      copy.appendChild(node('p', '', app.description));
      info.appendChild(copy);
      card.appendChild(info);

      const tags = node('div', 'playAppTags');
      (app.tags || []).forEach((tag) => tags.appendChild(node('span', '', tag)));
      if(tags.childNodes.length) card.appendChild(tags);

      const actions = node('div', 'playAppActions');
      if(app.playUrl){
        const store = node('a', 'btn primary', 'Κατέβασε την εφαρμογή');
        store.href = app.playUrl;
        store.target = '_blank';
        store.rel = 'noopener noreferrer';
        store.setAttribute('aria-label','Κατέβασε την εφαρμογή από το Google Play: ' + app.title);
        actions.appendChild(store);
      }
      const landing = node('a', 'btn', 'Ιστοσελίδα εφαρμογής');
      landing.href = app.landing;
      landing.setAttribute('aria-label','Ιστοσελίδα εφαρμογής: ' + app.title);
      actions.appendChild(landing);
      card.appendChild(actions);
      fragment.appendChild(card);
    });
    grid.replaceChildren(fragment);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', render, {once:true});
  }else{
    render();
  }
})();
