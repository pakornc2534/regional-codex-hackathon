import './dot-avatar.css';

export function DotRobot() {
  return <div className="dot-robot" aria-hidden="true">
    <i className="dot-robot-shadow" />
    <div className="dot-robot-figure">
      <div className="dot-robot-head">
        <i className="dot-robot-aerial" />
        <i className="dot-robot-ear dot-robot-ear-left" />
        <i className="dot-robot-ear dot-robot-ear-right" />
        <div className="dot-robot-shell">
          <div className="dot-robot-visor">
            <span className="dot-robot-eyes"><i /><i /></span>
            <i className="dot-robot-mouth" />
          </div>
        </div>
      </div>
      <div className="dot-robot-body">
        <i className="dot-robot-arm dot-robot-arm-left" /><i className="dot-robot-arm dot-robot-arm-right" />
        <i className="dot-robot-foot dot-robot-foot-left" /><i className="dot-robot-foot dot-robot-foot-right" />
        <div className="dot-robot-jacket"><i className="dot-robot-light" /><i className="dot-robot-speaker" /></div>
      </div>
    </div>
  </div>;
}
