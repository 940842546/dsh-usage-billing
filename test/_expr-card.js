(() => {
  const spark = document.querySelector('.usg-card-spark');
  const bars = spark ? [...spark.querySelectorAll('.usg-card-spark-bar')] : [];
  const card = document.querySelector('.usg-fab-card');
  const footer = document.querySelector('.usg-fab');
  return {
    hasSpark: !!spark,
    barCount: bars.length,
    barHeights: bars.map((b) => b.style.height),
    barOpacity: bars.map((b) => getComputedStyle(b).opacity),
    sparkRect: spark ? spark.getBoundingClientRect().toJSON() : null,
    cardText: card ? card.innerText.replace(/\s+/g, ' ').slice(0, 200) : null,
    hasCard: !!card,
    footerText: footer ? footer.innerText.replace(/\s+/g, ' ').slice(0, 120) : null,
    sidebarWide: !!card,
  };
})()
