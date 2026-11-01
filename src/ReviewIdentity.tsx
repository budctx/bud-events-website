import './reviews.css';
export function ReviewIdentity({name,avatarUrl}:{name:string;avatarUrl?:string|null}){
 return <div className="bud-review-person">
  {avatarUrl?<img className="bud-review-avatar" src={avatarUrl} alt="" width={40} height={40} referrerPolicy="no-referrer"/>:<span className="bud-review-avatar bud-review-avatar-fallback" aria-hidden="true">{name.trim().charAt(0)||'؟'}</span>}
  <span className="bud-review-person-name" dir="auto">{name}</span>
 </div>;
}
