import { economy, scoreText, strikeRate, type InningsDto, type TeamDto } from '@cmf/shared';

export function Scorecard({ innings, team }: { innings: InningsDto; team?: TeamDto }) {
  return (
    <div className="scorecard">
      <div className="scorecard-head">
        <strong>{team?.name ?? 'Innings'}</strong>
        <strong className="num">{scoreText(innings)}</strong>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="left">Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {innings.batting.map((b, i) => (
              <tr key={`${b.name}-${i}`}>
                <td className="left">
                  <span className={b.dismissal ? '' : 'strong'}>
                    {b.name}
                    {b.dismissal ? '' : ' *'}
                  </span>
                  <span className="dismissal">{b.dismissal ?? 'not out'}</span>
                </td>
                <td className="strong">{b.runs}</td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{strikeRate(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {innings.bowling.length > 0 && (
          <table>
            <thead>
              <tr>
                <th className="left">Bowler</th>
                <th>O</th>
                <th>M</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              {innings.bowling.map((b, i) => (
                <tr key={`${b.name}-${i}`}>
                  <td className="left">{b.name}</td>
                  <td>{b.overs}</td>
                  <td>{b.maidens}</td>
                  <td>{b.runs}</td>
                  <td className="strong">{b.wickets}</td>
                  <td>{economy(b.runs, b.overs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
