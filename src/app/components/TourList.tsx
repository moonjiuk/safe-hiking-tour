import React from "react";

type Spot = any; // 실제 타입 정의 필요

type TourListProps = {
  selectedLocationName: string | null;
  tourismSpots: Spot[];
  onTouristSpotClick: (spot: Spot) => void;
};

const TourList: React.FC<TourListProps> = ({ selectedLocationName, tourismSpots, onTouristSpotClick }) => {
  return (
    <div className="tourList">
      <div className="nearSpot"><strong>{selectedLocationName}</strong> 주변 관광지</div>
      <ul>
        {tourismSpots.map((spot, i) => (
          <li key={i} onClick={() => onTouristSpotClick(spot)}>
            <strong>{spot.title}</strong> ({(parseFloat(spot.dist)/1000).toFixed(1)}km)<br />{spot.addr1}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TourList; 