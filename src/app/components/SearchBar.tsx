import React from "react";

type Place = any; // 실제 타입 정의 필요

type SearchBarProps = {
  inputText: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  places: Place[];
  onPlaceSelect: (place: Place) => void;
  searchContainerRef: React.RefObject<HTMLDivElement>;
};

const SearchBar: React.FC<SearchBarProps> = ({ inputText, onInputChange, places, onPlaceSelect, searchContainerRef }) => {
  return (
    <div ref={searchContainerRef} className="search">
      <input value={inputText} onChange={onInputChange} placeholder="장소 검색" />
      {places.length > 0 && (
        <ul>
          {places.map((place, i) => (
            <li key={i} onClick={() => onPlaceSelect(place)}>
              <strong>{place.place_name}</strong><br />{place.address_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar; 