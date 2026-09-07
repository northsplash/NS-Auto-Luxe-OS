/** Keep chat laid out to the visible viewport, including when the iPad keyboard is open. */
export function bindChatViewport() {
  const apply = () => {
    const visible = Math.round(window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--ns-vvh', `${visible}px`);
    const onMessages = Boolean(document.querySelector('.os-tab-messages'));
    const keyboard = onMessages && window.innerHeight - visible > 80;
    document.documentElement.classList.toggle('ns-chat-kb', keyboard);
  };
  apply();
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  return () => {
    window.visualViewport?.removeEventListener('resize', apply);
    window.visualViewport?.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
    document.documentElement.classList.remove('ns-chat-kb');
    document.documentElement.style.removeProperty('--ns-vvh');
  };
}
