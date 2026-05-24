(function(){
  try{
    const header = document.querySelector('header .brand');
    if(header){
      const nav = document.createElement('nav');
      nav.style.marginInlineStart = 'auto';
      nav.style.display = 'flex';
      nav.style.gap = '12px';
      const links = [
        { href: '/api/reports/live', text: 'التقارير المباشرة' },
        { href: '/api/pinmap/today', text: 'خريطة PIN اليوم' },
        { href: '/healthz', text: 'الحالة' }
      ];
      links.forEach(l=>{ const a=document.createElement('a'); a.href=l.href; a.textContent=l.text; a.style.color='#fff'; a.style.textDecoration='none'; nav.appendChild(a); });

      // Admin gear (small, gray) for login
      const adminLink = document.createElement('a');
      adminLink.href = '/admin/login';
      adminLink.title = 'الإدارة';
      adminLink.textContent = '⚙️';
      adminLink.style.color = '#d1d5db';
      adminLink.style.textDecoration = 'none';
      adminLink.style.marginInlineStart = '8px';
      nav.appendChild(adminLink);

      header.parentElement && header.parentElement.appendChild(nav);
    }
  }catch(e){ /* no-op */ }
})();
