-- Seed random number generator per thread
math.randomseed(os.time())

local short_ids = {
    "LllgC4c",
    "_cWhlsl",
    "7mYt0Yq",
    "ULAyTyp",
    "WXnmkX_"
}

request = function()
    local random_index = math.random(1, #short_ids)
    local short_id = short_ids[random_index]
    
    wrk.method = "GET"
    wrk.path = "/short/" .. short_id
    
    return wrk.format()
end

response = function(status, headers, body)
    if status ~= 200 and status ~= 301 and status ~= 302 then
        print("GET /short/ failed with status: " .. status)
    end
end
