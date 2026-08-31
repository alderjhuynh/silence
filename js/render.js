(function(){
  const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  const sections = tocLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('siteNav');
  if(toggle && nav){
    toggle.addEventListener('click', ()=>{
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  const reveals = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const ro = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting) e.target.classList.add('is-visible');
      });
    }, { threshold: 0.12 });
    reveals.forEach(el=> ro.observe(el));
  } else {
    reveals.forEach(el=> el.classList.add('is-visible'));
  }

  if('IntersectionObserver' in window && sections.length){
    const io = new IntersectionObserver((entries)=>{
      let best = null, bestRatio = 0;
      entries.forEach(en=>{
        if(en.isIntersecting && en.intersectionRatio > bestRatio){
          bestRatio = en.intersectionRatio; best = en.target;
        }
      });
      if(!best) return;
      tocLinks.forEach(a=>{
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + best.id);
      });
    }, { rootMargin: "-30% 0px -60% 0px", threshold: [0,0.25,0.5,1] });
    sections.forEach(s=> io.observe(s));
  }

  const toTop = document.getElementById('toTop');
  if(toTop){
    const onScroll = ()=>{
      if(window.scrollY > 700) toTop.classList.add('is-visible');
      else toTop.classList.remove('is-visible');
    };
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
    toTop.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
  }

  const y = document.getElementById('year');
  if(y) y.textContent = new Date().getFullYear();

  const heroBg = document.querySelector('.hero-bg');
  if(heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    let ticking = false;
    window.addEventListener('scroll', ()=>{
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(()=>{
        const s = Math.min(window.scrollY * 0.18, 80);
        heroBg.style.transform = 'translateY(' + s * 0.35 + 'px) scale(1.04)';
        ticking = false;
      });
    }, {passive:true});
  }
})();
