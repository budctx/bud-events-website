export type Theme = 'light' | 'dark';
type Props = { name: 'question' | 'condition' | 'user' | 'timer'; theme: Theme };
export function Icon({ name, theme }: Props) {
  const large = name === 'question' || name === 'condition';
  return <picture className={`icon ${large ? 'icon--card' : ''}`}>
    {large && <source media="(min-width: 1150px)" srcSet={`/assets/${theme}-desktop-${name}.svg`} width="48" height="48" />}
    <img src={`/assets/${theme}-mobile-${name}.svg`} alt="" width={large ? 32 : 24} height={large ? 32 : 24} />
  </picture>;
}
